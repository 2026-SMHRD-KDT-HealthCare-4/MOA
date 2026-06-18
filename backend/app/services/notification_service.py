"""
알림 생성 서비스

RISK 알림을 연동상태 ACTIVE인 보호자 전원에게 생성하는 로직을 라우터와 분리하여,
자동 트리거(analyze 라우터)와 수동 호출(notification 라우터) 양쪽에서 재사용한다.
(요구사항 4번: 우선순위 없이 ACTIVE 보호자 전원에게 동시 발송)

NOTE: 실제 FCM 푸시 / SMS Fallback 발송은 아직 붙이지 않았다. 여기서는 DB에
      알림 레코드를 status='SENT'로 생성하는 것까지만 담당한다. 발송 모듈을 붙일 때
      이 함수 안에서 발송을 호출하고, 결과에 따라 status를 SENT/FAILED로 세팅하면 된다.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.models import GuardianSenior, LinkStatus, Notification


def create_risk_notifications_for_active_guardians(
    db: Session,
    senior_id: UUID,
    prediction_id: UUID,
    commit: bool = True,
) -> list[Notification]:
    """ACTIVE 연동 보호자 전원에게 RISK 알림을 생성한다.

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

    notifications: list[Notification] = []
    for link in active_links:
        notification = Notification(
            guardian_id=link.guardian_id,
            senior_id=senior_id,
            notification_type="RISK",
            prediction_id=prediction_id,
            status="SENT",
            sent_at=datetime.utcnow(),
        )
        db.add(notification)
        notifications.append(notification)

    if commit and notifications:
        db.commit()
        for n in notifications:
            db.refresh(n)

    return notifications
