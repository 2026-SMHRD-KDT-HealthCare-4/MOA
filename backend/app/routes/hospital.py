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
from app.models.models import Guardian, HospitalVisit, Senior, GuardianSenior, LinkStatus
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
    user_id: UUID = Depends(get_current_user_id),
):
    """보호자 또는 고령층 본인이 병원 방문 일정을 등록한다."""
    # 1. 보호자 등록 여부 체크
    guardian = db.query(Guardian).filter(Guardian.guardian_id == user_id).first()
    if guardian is not None:
        verify_guardian_senior_link(guardian.guardian_id, req.senior_id, db)
        creator_guardian_id = guardian.guardian_id
    else:
        # 2. 고령자 본인 등록 여부 체크
        senior = db.query(Senior).filter(Senior.senior_id == user_id).first()
        if senior is not None:
            if senior.senior_id != req.senior_id:
                raise HTTPException(status_code=403, detail="본인의 병원 일정만 등록할 수 있습니다.")
            
            # 연동된 보호자의 ID 확인
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
                        detail="시스템에 가입된 보호자가 없어 병원 일정을 등록할 수 없습니다."
                    )
        else:
            raise HTTPException(status_code=404, detail="사용자 정보를 찾을 수 없습니다.")

    visit = HospitalVisit(
        senior_id=req.senior_id,
        guardian_id=creator_guardian_id,
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
    user_id: UUID = Depends(get_current_user_id),
):
    """병원 일정 수정. 등록한 보호자 또는 고령층 본인만 가능."""
    visit = db.query(HospitalVisit).filter(HospitalVisit.visit_id == visit_id).first()
    if visit is None:
        raise HTTPException(status_code=404, detail="병원 일정을 찾을 수 없습니다.")

    is_authorized = False
    guardian = db.query(Guardian).filter(Guardian.guardian_id == user_id).first()
    if guardian is not None:
        if visit.guardian_id == guardian.guardian_id:
            is_authorized = True
    else:
        senior = db.query(Senior).filter(Senior.senior_id == user_id).first()
        if senior is not None:
            if visit.senior_id == senior.senior_id:
                is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="병원 일정을 수정할 권한이 없습니다.")

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
    user_id: UUID = Depends(get_current_user_id),
):
    """병원 일정 삭제. 등록한 보호자 또는 고령층 본인만 가능."""
    visit = db.query(HospitalVisit).filter(HospitalVisit.visit_id == visit_id).first()
    if visit is None:
        raise HTTPException(status_code=404, detail="병원 일정을 찾을 수 없습니다.")

    is_authorized = False
    guardian = db.query(Guardian).filter(Guardian.guardian_id == user_id).first()
    if guardian is not None:
        if visit.guardian_id == guardian.guardian_id:
            is_authorized = True
    else:
        senior = db.query(Senior).filter(Senior.senior_id == user_id).first()
        if senior is not None:
            if visit.senior_id == senior.senior_id:
                is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="병원 일정을 삭제할 권한이 없습니다.")

    db.delete(visit)
    db.commit()
    return {"status": "success", "message": "병원 일정이 삭제되었습니다."}
