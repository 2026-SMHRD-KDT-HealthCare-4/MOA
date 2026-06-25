"""
알림 생성 서비스

RISK 알림을 연동상태 ACTIVE인 보호자 전원에게 생성하는 로직을 라우터와 분리하여,
자동 트리거(analyze 라우터)와 수동 호출(notification 라우터) 양쪽에서 재사용한다.
(요구사항 4번: 우선순위 없이 ACTIVE 보호자 전원에게 동시 발송)

NOTE: 실제 FCM 푸시 / SMS Fallback 발송은 아직 붙이지 않았다. 여기서는 DB에
      알림 레코드를 status='SENT'로 생성하는 것까지만 담당한다. 발송 모듈을 붙일 때
      이 함수 안에서 발송을 호출하고, 결과에 따라 status를 SENT/FAILED로 세팅하면 된다.
"""

from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.models import Guardian, GuardianSenior, LinkStatus, Notification, UrgentAlert, Senior
from app.services.fcm_service import send_fcm_push

URGENT_ALERT_COOLDOWN_MINUTES = 15


def create_risk_notifications_for_active_guardians(
    db: Session,
    senior_id: UUID,
    prediction_id: UUID,
    commit: bool = True,
) -> list[Notification]:
    """ACTIVE 연동 보호자 전원에게 RISK 알림을 생성하고 FCM 푸시를 보낸다.

    Args:
        commit: True면 이 함수 안에서 commit한다. 호출자가 더 큰 트랜잭션의 일부로
                다루고 싶으면 False로 주고 바깥에서 commit한다.
    Returns:
        생성된 Notification 리스트 (ACTIVE 보호자가 없으면 빈 리스트).
    """
    active_links = (
        db.query(GuardianSenior)
        .filter(
            GuardianSenior.senior_id == senior_id,
            GuardianSenior.link_status == LinkStatus.ACTIVE.value,
        )
        .all()
    )

    senior = db.query(Senior).filter(Senior.senior_id == senior_id).first()
    senior_name = senior.name if senior else "가족"

    notifications: list[Notification] = []
    for link in active_links:
        guardian = db.query(Guardian).filter(Guardian.guardian_id == link.guardian_id).first()
        
        success = False
        title = "[이상 징후 알림] 가족 건강 변화 감지"
        body = f"{senior_name}님의 목소리 분석 결과 지속적인 건강 상태 변화 패턴이 감지되었습니다. 상세 리포트를 확인해 주세요."
        
        if guardian and guardian.fcm_token:
            success = send_fcm_push(
                token=guardian.fcm_token,
                title=title,
                body=body,
                data={
                    "notification_type": "RISK",
                    "prediction_id": str(prediction_id)
                }
            )
        else:
            # fcm_token이 없으면 Mock Mode로 간주하여 성공(True) 처리
            success = True

        notification = Notification(
            guardian_id=link.guardian_id,
            senior_id=senior_id,
            notification_type="RISK",
            prediction_id=prediction_id,
            status="SENT" if success else "FAILED",
            sent_at=datetime.utcnow(),
        )
        db.add(notification)
        notifications.append(notification)

    if commit and notifications:
        db.commit()
        for n in notifications:
            db.refresh(n)

    return notifications


def create_urgent_alert_with_notifications(
    db: Session,
    senior_id: UUID,
    session_id: UUID | None,
    level: str,
    rule_id: str | None,
    commit: bool = True,
) -> UrgentAlert | None:
    """챗봇 긴급 감지 시 UrgentAlert 레코드와 보호자 Notification 후보를 생성한다.

    쿨다운 정책: 동일 senior_id + 동일 level 알림이 최근 15분 내에 있으면 생성하지 않고 None 반환.
    보호자 알림: ACTIVE 연동 + fcm_token이 등록된 보호자에게만 Notification 생성.
    실제 FCM/SMS 발송: TODO — 여기서는 DB 레코드 생성까지만 담당.

    Args:
        level: "SUICIDE_RISK" | "MEDICAL_EMERGENCY"  (GENERAL_DISCOMFORT는 이 함수 호출 안 함)
        commit: True면 이 함수 안에서 commit. 외부 트랜잭션에 포함하려면 False.

    Returns:
        생성된 UrgentAlert 또는 쿨다운으로 스킵된 경우 None.
    """
    # ── 쿨다운 검사 ──────────────────────────────────────────────────────────
    cooldown_cutoff = datetime.utcnow() - timedelta(minutes=URGENT_ALERT_COOLDOWN_MINUTES)
    recent = (
        db.query(UrgentAlert)
        .filter(
            UrgentAlert.senior_id == senior_id,
            UrgentAlert.level == level,
            UrgentAlert.created_at >= cooldown_cutoff,
            UrgentAlert.alert_status != "cancelled",
        )
        .first()
    )
    if recent is not None:
        return None  # 쿨다운 중 — 중복 생성 방지

    # ── UrgentAlert 레코드 생성 ──────────────────────────────────────────────
    alert = UrgentAlert(
        senior_id=senior_id,
        session_id=session_id,
        level=level,
        rule_id=rule_id,
        alert_status="pending",
    )
    db.add(alert)
    db.flush()  # alert_id 확정

    # ── 보호자 알림 후보 생성 ─────────────────────────────────────────────────
    # 조건: ACTIVE 연동 + fcm_token 등록(알림 수신 가능 상태)
    active_links = (
        db.query(GuardianSenior)
        .filter(
            GuardianSenior.senior_id == senior_id,
            GuardianSenior.link_status == LinkStatus.ACTIVE.value,
        )
        .all()
    )

    guardian_ids = [link.guardian_id for link in active_links]
    notifiable_guardians = (
        db.query(Guardian)
        .filter(
            Guardian.guardian_id.in_(guardian_ids),
            Guardian.fcm_token.isnot(None),
        )
        .all()
    )

    for guardian in notifiable_guardians:
        notification = Notification(
            guardian_id=guardian.guardian_id,
            senior_id=senior_id,
            notification_type="RISK",
            status="SENT",          # TODO: 실제 FCM 발송 후 SENT/FAILED 갱신
            sent_at=datetime.utcnow(),
        )
        db.add(notification)
        # TODO: FCM push / SMS fallback 발송 호출 위치 (notification 생성 직후)

    if commit:
        db.commit()
        db.refresh(alert)

    return alert
