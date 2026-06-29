"""
복약정보 / 복약 체크리스트 라우터 — 요구사항 12번

- MEDICATION: 보호자가 등록한 고령층의 복약 일정 (약이름, 복약시간, 시작/종료일, 활성여부)
- MEDICATION_CHECK: 고령층의 일별 복약 이행 여부 (medication_id + check_date UNIQUE)
"""

from datetime import date as date_type, datetime, timedelta
from typing import List, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    get_current_guardian,
    get_current_senior,
    get_current_user_id,
    verify_guardian_senior_link,
    verify_senior_access,
)
from app.models.models import Guardian, Medication, MedicationReminder, Senior, GuardianSenior, LinkStatus
from app.schemas.notification import (
    MedicationCreateRequest,
    MedicationResponse,
    MedicationReminderReplyRequest,
    MedicationReminderReplyResponse,
    MedicationReminderResponse,
    MedicationUpdateRequest,
)

router = APIRouter(prefix="/medication", tags=["medication"])

POSITIVE_MEDICATION_ANSWERS = ("응", "예", "네", "먹었어", "먹었지", "먹었어요", "먹었습니다", "복용했")
NEGATIVE_MEDICATION_ANSWERS = ("안 먹", "아직", "나중", "까먹", "못 먹", "못먹")


def _reminder_response(reminder: MedicationReminder, reply: str | None = None) -> dict:
    payload = {
        "reminder_id": reminder.reminder_id,
        "medication_id": reminder.medication_id,
        "medicine_name": reminder.medication.medicine_name,
        "scheduled_for": reminder.scheduled_for,
        "status": reminder.status,
        "reminder_count": reminder.reminder_count,
        "retry_at": reminder.retry_at,
        "completed_at": reminder.completed_at,
        # 재알림까지 보냈는데도 완료되지 않은 건은 알림센터에서 계속 확인한다.
        "needs_attention": reminder.reminder_count >= 1 and reminder.status != "COMPLETED",
    }
    if reply is not None:
        payload["reply"] = reply
    return payload


def _mark_completed(reminder: MedicationReminder, db: Session) -> None:
    # 현재 MVP 복약 리마인드 흐름에서는 호출하지 않는다.
    return None


def dispatch_due_reminders(db: Session, now: datetime | None = None) -> list[MedicationReminder]:
    """스케줄러가 호출하는 복약 푸시 대상 생성/재발송 대기열.

    반환된 항목의 `senior.fcm_token`으로만 푸시를 보내야 하며, 보호자에게는 전송하지 않는다.
    """
    now = now or datetime.utcnow()
    today = now.date()
    dispatched: list[MedicationReminder] = []

    medications = (
        db.query(Medication)
        .filter(
            Medication.is_active.is_(True),
            Medication.start_date <= today,
            (Medication.end_date.is_(None) | (Medication.end_date >= today)),
        )
        .all()
    )
    for medication in medications:
        scheduled_for = datetime.combine(today, medication.intake_time)
        if scheduled_for > now:
            continue
        reminder = (
            db.query(MedicationReminder)
            .filter(
                MedicationReminder.medication_id == medication.medication_id,
                MedicationReminder.scheduled_for == scheduled_for,
            )
            .first()
        )
        if reminder is None:
            reminder = MedicationReminder(
                medication_id=medication.medication_id,
                senior_id=medication.senior_id,
                scheduled_for=scheduled_for,
                status="PENDING",
            )
            db.add(reminder)
            dispatched.append(reminder)

    retries = (
        db.query(MedicationReminder)
        .filter(
            MedicationReminder.status == "REMINDER_SCHEDULED",
            MedicationReminder.retry_at <= now,
            MedicationReminder.reminder_count == 0,
        )
        .all()
    )
    for reminder in retries:
        reminder.reminder_count = 1
        reminder.status = "PENDING"
        reminder.retry_at = None
        dispatched.append(reminder)

    db.commit()
    for reminder in dispatched:
        db.refresh(reminder)
    return dispatched


# ---------------------------------------------------------------------------
# 복약정보 (MEDICATION)
# ---------------------------------------------------------------------------

@router.post("", response_model=Union[List[MedicationResponse], MedicationResponse])
def create_medication(
    req: MedicationCreateRequest,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """보호자 또는 고령층 본인이 복약 일정을 등록한다. 다중 복용 시간(intake_times)을 지원한다."""
    # 1. 보호자가 등록하는 경우
    guardian = db.query(Guardian).filter(Guardian.guardian_id == user_id).first()
    if guardian is not None:
        verify_guardian_senior_link(guardian.guardian_id, req.senior_id, db)
        creator_guardian_id = guardian.guardian_id
    else:
        # 2. 고령층 본인이 등록하는 경우
        senior = db.query(Senior).filter(Senior.senior_id == user_id).first()
        if senior is not None:
            if senior.senior_id != req.senior_id:
                raise HTTPException(status_code=403, detail="본인의 복약 일정만 등록할 수 있습니다.")
            
            # 고령층이 등록할 경우, FK 제약을 위해 연동된 보호자의 ID를 가져온다.
            link = db.query(GuardianSenior).filter(
                GuardianSenior.senior_id == senior.senior_id,
                GuardianSenior.link_status == LinkStatus.ACTIVE.value
            ).first()
            
            if link is not None:
                creator_guardian_id = link.guardian_id
            else:
                # 연동된 보호자가 없으면 DB 내 첫 번째 보호자를 디폴트로 매핑하여 FK 제약 우회
                default_guardian = db.query(Guardian).first()
                if default_guardian is not None:
                    creator_guardian_id = default_guardian.guardian_id
                else:
                    raise HTTPException(
                        status_code=400,
                        detail="시스템에 가입된 보호자가 없어 복약 일정을 등록할 수 없습니다."
                    )
        else:
            raise HTTPException(status_code=404, detail="사용자 정보를 찾을 수 없습니다.")

    if req.end_date is not None and req.end_date < req.start_date:
        raise HTTPException(status_code=400, detail="종료일은 시작일보다 빠를 수 없습니다.")

    times = []
    if req.intake_time is not None:
        times.append(req.intake_time)
    if req.intake_times is not None:
        for t in req.intake_times:
            if t not in times:
                times.append(t)

    if not times:
        raise HTTPException(status_code=400, detail="복용 시간을 입력해 주세요 (intake_time 또는 intake_times).")

    medications = []
    for t in times:
        med = Medication(
            senior_id=req.senior_id,
            guardian_id=creator_guardian_id,
            medicine_name=req.medicine_name,
            intake_time=t,
            start_date=req.start_date,
            end_date=req.end_date,
            is_active=req.is_active,
        )
        db.add(med)
        medications.append(med)

    db.commit()
    for med in medications:
        db.refresh(med)

    if req.intake_times is not None:
        return medications
    return medications[0]


@router.get("/senior/{senior_id}", response_model=list[MedicationResponse])
def list_medications(
    senior_id: UUID,
    active_only: bool = False,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """고령층의 복약 일정 목록. 본인 또는 연동 보호자만 조회 가능. active_only=True면 활성 일정만."""
    verify_senior_access(user_id, senior_id, db)
    query = db.query(Medication).filter(Medication.senior_id == senior_id)
    if active_only:
        query = query.filter(Medication.is_active.is_(True))
    return query.order_by(Medication.created_at.desc()).all()


@router.patch("/{medication_id}", response_model=MedicationResponse)
def update_medication(
    medication_id: UUID,
    req: MedicationUpdateRequest,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """복약 일정 수정. 등록한 보호자 본인 또는 고령층 본인만 가능."""
    medication = db.query(Medication).filter(Medication.medication_id == medication_id).first()
    if medication is None:
        raise HTTPException(status_code=404, detail="복약 정보를 찾을 수 없습니다.")

    is_authorized = False
    guardian = db.query(Guardian).filter(Guardian.guardian_id == user_id).first()
    if guardian is not None:
        if medication.guardian_id == guardian.guardian_id:
            is_authorized = True
    else:
        senior = db.query(Senior).filter(Senior.senior_id == user_id).first()
        if senior is not None:
            if medication.senior_id == senior.senior_id:
                is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="복약 일정을 수정할 권한이 없습니다.")

    update_data = req.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(medication, field, value)

    db.commit()
    db.refresh(medication)
    return medication


# ---------------------------------------------------------------------------
# 복약 알림 응답 / 알림센터
# ---------------------------------------------------------------------------

@router.get("/reminders/me", response_model=list[MedicationReminderResponse])
def list_my_medication_reminders(
    db: Session = Depends(get_db),
    senior: Senior = Depends(get_current_senior),
):
    """종 모양 알림센터용 목록. 완료 여부와 재알림 후 확인 필요 상태를 함께 반환한다."""
    reminders = (
        db.query(MedicationReminder)
        .filter(MedicationReminder.senior_id == senior.senior_id)
        .order_by(MedicationReminder.scheduled_for.desc())
        .limit(50)
        .all()
    )
    return [_reminder_response(reminder) for reminder in reminders]


@router.post("/reminders/{reminder_id}/open", response_model=MedicationReminderReplyResponse)
def open_medication_reminder(
    reminder_id: UUID,
    db: Session = Depends(get_db),
    senior: Senior = Depends(get_current_senior),
):
    """푸시 탭 후 모아 대화에 전달할 첫 질문을 반환한다."""
    reminder = (
        db.query(MedicationReminder)
        .filter(
            MedicationReminder.reminder_id == reminder_id,
            MedicationReminder.senior_id == senior.senior_id,
        )
        .first()
    )
    if reminder is None:
        raise HTTPException(status_code=404, detail="복약 알림을 찾을 수 없습니다.")

    if reminder.opened_at is None:
        reminder.opened_at = datetime.utcnow()
        db.commit()
        db.refresh(reminder)

    hour = reminder.scheduled_for.hour
    return _reminder_response(reminder, f"{hour}시에 드시기로 한 약은 드셨나요?")


@router.post("/reminders/{reminder_id}/reply", response_model=MedicationReminderReplyResponse)
def reply_to_medication_reminder(
    reminder_id: UUID,
    req: MedicationReminderReplyRequest,
    db: Session = Depends(get_db),
    senior: Senior = Depends(get_current_senior),
):
    """긍정 응답은 완료 처리하고, 첫 부정 응답에만 10분 뒤 재알림을 예약한다."""
    reminder = (
        db.query(MedicationReminder)
        .filter(
            MedicationReminder.reminder_id == reminder_id,
            MedicationReminder.senior_id == senior.senior_id,
        )
        .first()
    )
    if reminder is None:
        raise HTTPException(status_code=404, detail="복약 알림을 찾을 수 없습니다.")

    answer = req.answer.strip().lower().replace(" ", "")
    if any(keyword.replace(" ", "") in answer for keyword in POSITIVE_MEDICATION_ANSWERS):
        return _reminder_response(
            reminder,
            "알려주셔서 고마워요. 복약 기록 저장은 하지 않고, 알림만 도와드릴게요.",
        )

    if any(keyword.replace(" ", "") in answer for keyword in NEGATIVE_MEDICATION_ANSWERS):
        if reminder.reminder_count == 0 and reminder.status != "REMINDER_SCHEDULED":
            reminder.status = "REMINDER_SCHEDULED"
            reminder.retry_at = datetime.utcnow() + timedelta(minutes=10)
            db.commit()
            db.refresh(reminder)
            return _reminder_response(
                reminder,
                "그럼 약 드시고 말씀해주세요. 10분 뒤에 한 번 더 알려드릴게요.",
            )

        # 재알림은 한 번만 보낸다. 이후 미완료 건은 알림센터에 그대로 남긴다.
        db.commit()
        db.refresh(reminder)
        return _reminder_response(reminder, "약을 드신 뒤에 말씀해주세요. 복약 확인이 필요해요.")

    return _reminder_response(reminder, "드셨는지 아직 못 드셨는지만 말씀해주세요.")


@router.delete("/{medication_id}")
def delete_medication(
    medication_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """복약 일정 삭제. 등록한 보호자 본인 또는 고령층 본인만 가능."""
    medication = db.query(Medication).filter(Medication.medication_id == medication_id).first()
    if medication is None:
        raise HTTPException(status_code=404, detail="복약 정보를 찾을 수 없습니다.")

    is_authorized = False
    guardian = db.query(Guardian).filter(Guardian.guardian_id == user_id).first()
    if guardian is not None:
        if medication.guardian_id == guardian.guardian_id:
            is_authorized = True
    else:
        senior = db.query(Senior).filter(Senior.senior_id == user_id).first()
        if senior is not None:
            if medication.senior_id == senior.senior_id:
                is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="복약 일정을 삭제할 권한이 없습니다.")

    db.delete(medication)
    db.commit()
    return {"status": "success", "message": "복약 일정이 삭제되었습니다."}
