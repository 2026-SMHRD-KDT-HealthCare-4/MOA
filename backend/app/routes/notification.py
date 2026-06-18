"""
알림 라우터 — 요구사항 10, 11번 (+ 4번 연계)

- NOTIFICATION 한 테이블에서 이상징후(RISK)/복약(MEDICATION)/병원(HOSPITAL)/미접속(INACTIVE)
  알림을 통합 관리한다.
- status는 SENT/FAILED/READ. FCM 푸시 실패 시 SMS Fallback이 적용되는 점을 고려한 구분이며,
  실제 발송 로직(FCM/SMS)은 아직 붙이지 않았다. 여기서는 DB 기록/조회만 담당한다.
- 이상 징후(RISK) 알림은 요구사항 4번에 따라 연동상태가 ACTIVE인 보호자 전원에게 동시에
  생성한다. (우선순위 개념 없음)
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_guardian
from app.models.models import Guardian, Notification, Senior
from app.schemas.notification import NotificationCreateRequest, NotificationResponse
from app.services.notification_service import create_risk_notifications_for_active_guardians

router = APIRouter(prefix="/notification", tags=["notification"])


# NOTE: 알림 생성(POST "", POST /risk/{senior_id})은 사용자가 직접 호출하는 API가 아니라
# 시스템 내부 로직(위험도 추론 후 자동 발송, 복약 스케줄러 등)에서 트리거되는 엔드포인트다.
# 따라서 사용자 토큰 가드 대신, 추후 내부 서비스 인증(시스템 API 키 또는 내부 함수 호출로 전환)
# 으로 보호해야 한다. 외부에 그대로 노출하지 않도록 배포 시 네트워크/게이트웨이 레벨에서도 차단 권장.
# 반면 조회/읽음처리는 보호자가 직접 호출하므로 보호자 인증 가드를 적용한다.


@router.post("", response_model=NotificationResponse)
def create_notification(req: NotificationCreateRequest, db: Session = Depends(get_db)):
    """단일 보호자 대상 알림 생성 (복약/병원/미접속 등 특정 보호자에게 보낼 때)."""
    notification = Notification(
        guardian_id=req.guardian_id,
        senior_id=req.senior_id,
        notification_type=req.notification_type,
        prediction_id=req.prediction_id,
        medication_id=req.medication_id,
        status=req.status,
        sent_at=datetime.utcnow(),
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/risk/{senior_id}", response_model=list[NotificationResponse])
def create_risk_notifications(
    senior_id: UUID, prediction_id: UUID, db: Session = Depends(get_db)
):
    """이상 징후(RISK) 알림을 연동상태 ACTIVE인 보호자 전원에게 생성한다. (요구사항 4번)"""
    senior = db.query(Senior).filter(Senior.senior_id == senior_id).first()
    if senior is None:
        raise HTTPException(status_code=404, detail="고령층 회원을 찾을 수 없습니다.")

    notifications = create_risk_notifications_for_active_guardians(
        db, senior_id, prediction_id
    )
    if not notifications:
        raise HTTPException(status_code=404, detail="연동된(ACTIVE) 보호자가 없습니다.")

    return notifications


@router.get("/guardian/me", response_model=list[NotificationResponse])
def list_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    guardian: Guardian = Depends(get_current_guardian),
):
    """로그인한 보호자가 받은 알림 목록 (최근순). unread_only=True면 아직 READ 아닌 것만."""
    query = db.query(Notification).filter(Notification.guardian_id == guardian.guardian_id)
    if unread_only:
        query = query.filter(Notification.status != "READ")
    return query.order_by(Notification.sent_at.desc()).limit(50).all()


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_as_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    guardian: Guardian = Depends(get_current_guardian),
):
    """보호자가 알림을 확인했을 때 status를 READ로 변경한다. 본인 알림만 가능. (요구사항 11번)"""
    notification = (
        db.query(Notification).filter(Notification.notification_id == notification_id).first()
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")

    if notification.guardian_id != guardian.guardian_id:
        raise HTTPException(status_code=403, detail="본인에게 온 알림만 확인 처리할 수 있습니다.")

    notification.status = "READ"
    db.commit()
    db.refresh(notification)
    return notification
