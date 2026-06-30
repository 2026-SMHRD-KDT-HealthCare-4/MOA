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
from app.services.sms_service import send_sms_fallback

URGENT_ALERT_COOLDOWN_MINUTES = 15


def create_risk_notifications_for_active_guardians(
    db: Session,
    senior_id: UUID,
    prediction_id: UUID,
    commit: bool = True,
) -> list[Notification]:
    """ACTIVE 연동 보호자 전원에게 RISK 알림을 생성하고 FCM 푸시를 보낸다. 푸시 실패 시 SMS/알림톡 릴레이를 시도한다."""
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
        if not guardian:
            continue
        
        if not guardian.push_enabled:
            continue
            
        success = False
        title = "[이상 징후 알림] 가족 건강 변화 감지"
        body = f"{senior_name}님의 목소리 분석 결과 지속적인 건강 상태 변화 패턴이 감지되었습니다. 상세 리포트를 확인해 주세요."
        
        if guardian.fcm_token:
            success = send_fcm_push(
                token=guardian.fcm_token,
                title=title,
                body=body,
                data={
                    "notification_type": "RISK",
                    "prediction_id": str(prediction_id)
                }
            )
            
        # [Safety Net] FCM 실패 또는 토큰 없는 경우 즉시 SMS/알림톡 채널로 우회 발송 (Multi-Channel Failover)
        if not success:
            sms_body = f"[MOA 알림] {title}\n{body}\n상세 리포트 확인: https://moa.app/report"
            success = send_sms_fallback(guardian.phone, sms_body)

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
    """챗봇 긴급 감지 시 UrgentAlert 레코드와 보호자 Notification 후보를 생성하고 FCM/SMS로 즉각 전파한다."""
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
        return None

    alert = UrgentAlert(
        senior_id=senior_id,
        session_id=session_id,
        level=level,
        rule_id=rule_id,
        alert_status="pending",
    )
    db.add(alert)
    db.flush()

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
        .filter(Guardian.guardian_id.in_(guardian_ids))
        .all()
    )

    senior = db.query(Senior).filter(Senior.senior_id == senior_id).first()
    senior_name = senior.name if senior else "가족"

    for guardian in notifiable_guardians:
        if not guardian.push_enabled:
            continue

        title = f"[긴급 상황 알림] 가족 긴급 지원 감지"
        body = f"{senior_name}님의 대화 중 긴급 의료상황 혹은 감정 이상 징후가 감지되었습니다. 즉시 확인이 필요합니다."

        success = False
        if guardian.fcm_token:
            success = send_fcm_push(
                token=guardian.fcm_token,
                title=title,
                body=body,
                data={"notification_type": "URGENT_RISK"}
            )
            
        # [Safety Net] 긴급 푸시 알림 실패 시 또는 비활성 기기일 시 카카오/SMS 채널 즉시 릴레이 (다중 채널 보장)
        if not success:
            sms_body = f"[MOA 긴급] {title}\n{body}\n보호자용 핫라인 연결 또는 확인을 부탁드립니다."
            success = send_sms_fallback(guardian.phone, sms_body)

        notification = Notification(
            guardian_id=guardian.guardian_id,
            senior_id=senior_id,
            notification_type="RISK",
            status="SENT" if success else "FAILED",
            sent_at=datetime.utcnow(),
        )
        db.add(notification)

    if commit:
        db.commit()
        db.refresh(alert)

    return alert
