"""
인증 / 회원가입 / 보호자-고령층 연동 라우터

설계 원칙
- 비밀번호 자체는 Supabase Auth(auth.users)가 전담한다. 우리 쪽 GUARDIAN/SENIOR
  테이블에는 password 컬럼을 두지 않고, 프로필/임상 메타데이터만 저장한다.
- GUARDIAN.guardian_id / SENIOR.senior_id 는 Supabase auth.users.id(UUID)와 동일한 값을 사용한다.
- 초대링크(INVITE) 검증과 만료 처리는 애플리케이션 레이어(여기)에서 수행한다. (요구사항 17번)
"""

from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_guardian
from app.core.supabase_client import supabase
from app.models.models import Guardian, GuardianSenior, Invite, LinkStatus, Senior
from app.schemas.auth import (
    GuardianRegisterRequest,
    GuardianResponse,
    GuardianSeniorResponse,
    InviteCreateResponse,
    InviteVerifyResponse,
    LinkStatusUpdateRequest,
    LoginRequest,
    SeniorRegisterRequest,
    SeniorResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

INVITE_EXPIRE_HOURS = 72


# ---------------------------------------------------------------------------
# 공통 헬퍼
# ---------------------------------------------------------------------------

def _supabase_sign_up(email: str, password: str, role: str, name: str):
    """Supabase Auth 가입. 실패 시 HTTPException 발생."""
    try:
        res = supabase.auth.sign_up(
            {
                "email": email,
                "password": password,
                "options": {"data": {"role": role, "name": name}},
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Supabase 가입 실패: {e}")

    if res.user is None:
        raise HTTPException(status_code=400, detail="회원가입에 실패했습니다.")
    return res.user


def _supabase_delete_user(user_id: str) -> None:
    """프로필 테이블 저장 실패 시 Supabase 쪽 가입을 롤백(보상 트랜잭션)."""
    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception:
        # 롤백 실패는 로깅만 하고 원래 에러를 그대로 전달한다.
        pass


# ---------------------------------------------------------------------------
# 보호자 회원가입 / 로그인
# ---------------------------------------------------------------------------

@router.post("/guardian/register", response_model=GuardianResponse)
def register_guardian(req: GuardianRegisterRequest, db: Session = Depends(get_db)):
    user = _supabase_sign_up(req.email, req.password, role="guardian", name=req.name)

    guardian = Guardian(
        guardian_id=UUID(user.id),
        email=req.email,
        name=req.name,
        birth_date=req.birth_date,
        gender=req.gender,
        phone=req.phone,
        biometric_consent_yn=req.biometric_consent_yn,
        consent_at=datetime.utcnow() if req.biometric_consent_yn else None,
    )

    try:
        db.add(guardian)
        db.commit()
        db.refresh(guardian)
    except Exception as e:
        db.rollback()
        _supabase_delete_user(user.id)
        raise HTTPException(status_code=400, detail=f"보호자 프로필 저장 실패: {e}")

    return guardian


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    try:
        res = supabase.auth.sign_in_with_password(
            {"email": req.email, "password": req.password}
        )
    except Exception:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다.")

    if res.user is None or res.session is None:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다.")

    user_id = UUID(res.user.id)

    # GUARDIAN, SENIOR 양쪽 테이블에서 프로필을 조회해 role을 판별한다.
    guardian = db.query(Guardian).filter(Guardian.guardian_id == user_id).first()
    senior = db.query(Senior).filter(Senior.senior_id == user_id).first()

    if guardian is not None:
        role, name = "guardian", guardian.name
    elif senior is not None:
        role, name = "senior", senior.name
    else:
        raise HTTPException(status_code=404, detail="가입된 프로필을 찾을 수 없습니다.")

    return {
        "status": "success",
        "data": {
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
            "role": role,
            "name": name,
        },
    }


@router.post("/logout")
def logout():
    try:
        supabase.auth.sign_out()
        return {"status": "success", "message": "로그아웃 완료"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# 초대링크 (요구사항 3, 17번)
# ---------------------------------------------------------------------------

@router.post("/invite", response_model=InviteCreateResponse)
def create_invite(
    db: Session = Depends(get_db),
    guardian: Guardian = Depends(get_current_guardian),
):
    """초대링크 생성. 토큰의 보호자 본인 명의로 발급한다."""
    invite = Invite(
        guardian_id=guardian.guardian_id,
        expired_at=datetime.utcnow() + timedelta(hours=INVITE_EXPIRE_HOURS),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite


@router.get("/invite/{token}/verify", response_model=InviteVerifyResponse)
def verify_invite(token: UUID, db: Session = Depends(get_db)):
    invite = db.query(Invite).filter(Invite.token == token).first()

    if invite is None:
        return InviteVerifyResponse(valid=False, reason="NOT_FOUND")
    if invite.is_used:
        return InviteVerifyResponse(valid=False, reason="USED")
    if invite.expired_at < datetime.utcnow():
        return InviteVerifyResponse(valid=False, reason="EXPIRED")

    guardian = db.query(Guardian).filter(Guardian.guardian_id == invite.guardian_id).first()
    return InviteVerifyResponse(valid=True, guardian_name=guardian.name if guardian else None)


# ---------------------------------------------------------------------------
# 고령층 회원가입 (초대링크 기반) — 요구사항 3, 4번
# ---------------------------------------------------------------------------

@router.post("/senior/register", response_model=SeniorResponse)
def register_senior(req: SeniorRegisterRequest, db: Session = Depends(get_db)):
    invite = db.query(Invite).filter(Invite.token == req.invite_token).first()

    if invite is None:
        raise HTTPException(status_code=404, detail="초대링크를 찾을 수 없습니다.")
    if invite.is_used:
        raise HTTPException(status_code=400, detail="이미 사용된 초대링크입니다.")
    if invite.expired_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="만료된 초대링크입니다. 재발송을 요청해주세요.")

    user = _supabase_sign_up(req.email, req.password, role="senior", name=req.name)

    senior = Senior(
        senior_id=UUID(user.id),
        email=req.email,
        name=req.name,
        birth_date=req.birth_date,
        gender=req.gender,
        phone=req.phone,
        smoking_yn=req.smoking_yn,
        bmi=req.bmi,
        medical_history=req.medical_history,
        biometric_consent_yn=req.biometric_consent_yn,
        consent_at=datetime.utcnow() if req.biometric_consent_yn else None,
    )

    try:
        db.add(senior)
        db.flush()  # senior_id 확정

        # 초대한 보호자와 즉시 ACTIVE 연동 (요구사항 4번: 우선순위 없이 다대다 관리)
        link = GuardianSenior(
            guardian_id=invite.guardian_id,
            senior_id=senior.senior_id,
            link_status=LinkStatus.ACTIVE.value,
            linked_at=datetime.utcnow(),
        )
        db.add(link)

        invite.is_used = True
        db.add(invite)

        db.commit()
        db.refresh(senior)
    except Exception as e:
        db.rollback()
        _supabase_delete_user(user.id)
        raise HTTPException(status_code=400, detail=f"고령층 프로필 저장 실패: {e}")

    return senior


# ---------------------------------------------------------------------------
# 보호자-고령층 연동 관리 — 요구사항 4번
# ---------------------------------------------------------------------------

@router.get("/guardian/seniors", response_model=list[GuardianSeniorResponse])
def list_seniors_for_guardian(
    db: Session = Depends(get_db),
    guardian: Guardian = Depends(get_current_guardian),
):
    """로그인한 보호자가 관리하는 모든 고령층 연동 목록 (PENDING/ACTIVE/REVOKED 전체)."""
    links = (
        db.query(GuardianSenior)
        .filter(GuardianSenior.guardian_id == guardian.guardian_id)
        .all()
    )
    return links


@router.patch("/link/{link_id}", response_model=GuardianSeniorResponse)
def update_link_status(
    link_id: UUID,
    req: LinkStatusUpdateRequest,
    db: Session = Depends(get_db),
    guardian: Guardian = Depends(get_current_guardian),
):
    """연동 상태 변경 (ACTIVE 전환 / REVOKED 처리). 본인 명의의 연동만 수정 가능."""
    link = db.query(GuardianSenior).filter(GuardianSenior.link_id == link_id).first()
    if link is None:
        raise HTTPException(status_code=404, detail="연동 정보를 찾을 수 없습니다.")

    if link.guardian_id != guardian.guardian_id:
        raise HTTPException(status_code=403, detail="본인의 연동 정보만 변경할 수 있습니다.")

    link.link_status = req.link_status
    if req.link_status == LinkStatus.ACTIVE.value:
        link.linked_at = datetime.utcnow()

    db.commit()
    db.refresh(link)
    return link
