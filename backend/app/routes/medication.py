"""
복약정보 / 복약 체크리스트 라우터 — 요구사항 12번

- MEDICATION: 보호자가 등록한 고령층의 복약 일정 (약이름, 복약시간, 시작/종료일, 활성여부)
- MEDICATION_CHECK: 고령층의 일별 복약 이행 여부 (medication_id + check_date UNIQUE)
"""

from datetime import date as date_type
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
from app.models.models import Guardian, Medication, MedicationCheck, Senior
from app.schemas.notification import (
    MedicationCheckRequest,
    MedicationCheckResponse,
    MedicationCreateRequest,
    MedicationResponse,
    MedicationUpdateRequest,
)

router = APIRouter(prefix="/medication", tags=["medication"])


# ---------------------------------------------------------------------------
# 복약정보 (MEDICATION)
# ---------------------------------------------------------------------------

@router.post("", response_model=MedicationResponse)
def create_medication(
    req: MedicationCreateRequest,
    db: Session = Depends(get_db),
    guardian: Guardian = Depends(get_current_guardian),
):
    """보호자가 연동된 고령층의 복약 일정을 등록한다."""
    # 토큰의 보호자가 해당 고령층에 ACTIVE 연동돼 있는지 검증
    verify_guardian_senior_link(guardian.guardian_id, req.senior_id, db)

    if req.end_date is not None and req.end_date < req.start_date:
        raise HTTPException(status_code=400, detail="종료일은 시작일보다 빠를 수 없습니다.")

    medication = Medication(
        senior_id=req.senior_id,
        guardian_id=guardian.guardian_id,  # 토큰 본인 ID 사용
        medicine_name=req.medicine_name,
        intake_time=req.intake_time,
        start_date=req.start_date,
        end_date=req.end_date,
        is_active=req.is_active,
    )
    db.add(medication)
    db.commit()
    db.refresh(medication)
    return medication


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
    guardian: Guardian = Depends(get_current_guardian),
):
    """복약 일정 수정. 등록한 보호자 본인만 가능."""
    medication = db.query(Medication).filter(Medication.medication_id == medication_id).first()
    if medication is None:
        raise HTTPException(status_code=404, detail="복약 정보를 찾을 수 없습니다.")

    if medication.guardian_id != guardian.guardian_id:
        raise HTTPException(status_code=403, detail="본인이 등록한 복약 일정만 수정할 수 있습니다.")

    update_data = req.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(medication, field, value)

    db.commit()
    db.refresh(medication)
    return medication


# ---------------------------------------------------------------------------
# 복약 체크리스트 (MEDICATION_CHECK)
# ---------------------------------------------------------------------------

@router.post("/check", response_model=MedicationCheckResponse)
def check_medication(
    req: MedicationCheckRequest,
    db: Session = Depends(get_db),
    senior: Senior = Depends(get_current_senior),
):
    """고령층 본인의 일별 복약 이행 여부 기록. 같은 (medication_id, check_date)는 갱신(upsert)."""
    medication = db.query(Medication).filter(Medication.medication_id == req.medication_id).first()
    if medication is None:
        raise HTTPException(status_code=404, detail="복약 정보를 찾을 수 없습니다.")

    # 본인의 복약 일정인지 확인
    if medication.senior_id != senior.senior_id:
        raise HTTPException(status_code=403, detail="본인의 복약 일정만 체크할 수 있습니다.")

    target_date = req.check_date or date_type.today()

    # UNIQUE(medication_id, check_date) 이므로 기존 레코드가 있으면 갱신
    existing = (
        db.query(MedicationCheck)
        .filter(
            MedicationCheck.medication_id == req.medication_id,
            MedicationCheck.check_date == target_date,
        )
        .first()
    )

    if existing is not None:
        existing.is_completed = req.is_completed
        db.commit()
        db.refresh(existing)
        return existing

    check = MedicationCheck(
        medication_id=req.medication_id,
        senior_id=senior.senior_id,  # 토큰 본인 ID 사용
        check_date=target_date,
        is_completed=req.is_completed,
    )
    db.add(check)
    db.commit()
    db.refresh(check)
    return check


@router.get("/check/{senior_id}", response_model=list[MedicationCheckResponse])
def list_checks(
    senior_id: UUID,
    check_date: date_type | None = None,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """고령층의 복약 체크 이력. 본인 또는 연동 보호자만 조회 가능. check_date 지정 시 해당 일자만."""
    verify_senior_access(user_id, senior_id, db)
    query = db.query(MedicationCheck).filter(MedicationCheck.senior_id == senior_id)
    if check_date is not None:
        query = query.filter(MedicationCheck.check_date == check_date)
    return query.order_by(MedicationCheck.check_date.desc()).all()
