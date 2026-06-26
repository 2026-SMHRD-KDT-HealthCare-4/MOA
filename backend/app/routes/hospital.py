from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    get_current_guardian,
    get_current_user_id,
    verify_guardian_senior_link,
    verify_senior_access,
)
from app.models.models import Guardian, HospitalVisit, Senior
from app.schemas.hospital import (
    HospitalVisitCreateRequest,
    HospitalVisitResponse,
    HospitalVisitUpdateRequest,
)

router = APIRouter(prefix="/hospital", tags=["hospital"])


@router.post("", response_model=HospitalVisitResponse)
def create_hospital_visit(
    req: HospitalVisitCreateRequest,
    db: Session = Depends(get_db),
    guardian: Guardian = Depends(get_current_guardian),
):
    """보호자가 연동된 고령층의 병원 방문 일정을 등록한다."""
    verify_guardian_senior_link(guardian.guardian_id, req.senior_id, db)

    visit = HospitalVisit(
        senior_id=req.senior_id,
        guardian_id=guardian.guardian_id,
        hospital_name=req.hospital_name.strip(),
        visit_date=req.visit_date,
        visit_time=req.visit_time,
        memo=req.memo.strip() if req.memo else None,
        is_active=req.is_active,
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return visit


@router.get("/senior/{senior_id}", response_model=list[HospitalVisitResponse])
def list_hospital_visits(
    senior_id: UUID,
    active_only: bool = False,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """고령층의 병원 일정 목록 조회. 본인 또는 연동 보호자만 조회 가능."""
    verify_senior_access(user_id, senior_id, db)
    query = db.query(HospitalVisit).filter(HospitalVisit.senior_id == senior_id)
    if active_only:
        query = query.filter(HospitalVisit.is_active.is_(True))
    return query.order_by(HospitalVisit.visit_date.desc(), HospitalVisit.visit_time.desc()).all()


@router.patch("/{visit_id}", response_model=HospitalVisitResponse)
def update_hospital_visit(
    visit_id: UUID,
    req: HospitalVisitUpdateRequest,
    db: Session = Depends(get_db),
    guardian: Guardian = Depends(get_current_guardian),
):
    """병원 일정 수정. 등록한 보호자 본인만 가능."""
    visit = db.query(HospitalVisit).filter(HospitalVisit.visit_id == visit_id).first()
    if visit is None:
        raise HTTPException(status_code=404, detail="병원 일정을 찾을 수 없습니다.")

    if visit.guardian_id != guardian.guardian_id:
        raise HTTPException(status_code=403, detail="본인이 등록한 일정만 수정할 수 있습니다.")

    update_data = req.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "hospital_name" or field == "memo":
            setattr(visit, field, value.strip() if value else None)
        else:
            setattr(visit, field, value)

    db.commit()
    db.refresh(visit)
    return visit


@router.delete("/{visit_id}")
def delete_hospital_visit(
    visit_id: UUID,
    db: Session = Depends(get_db),
    guardian: Guardian = Depends(get_current_guardian),
):
    """병원 일정 삭제. 등록한 보호자 본인만 가능."""
    visit = db.query(HospitalVisit).filter(HospitalVisit.visit_id == visit_id).first()
    if visit is None:
        raise HTTPException(status_code=404, detail="병원 일정을 찾을 수 없습니다.")

    if visit.guardian_id != guardian.guardian_id:
        raise HTTPException(status_code=403, detail="본인이 등록한 일정만 삭제할 수 있습니다.")

    db.delete(visit)
    db.commit()
    return {"status": "success", "message": "병원 일정이 삭제되었습니다."}
