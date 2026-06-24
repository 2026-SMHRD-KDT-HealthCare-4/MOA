"""
인증 / 회원가입 / 보호자-고령층 연동 라우터

설계 원칙
- 비밀번호 자체는 Supabase Auth(auth.users)가 전담한다. 우리 쪽 GUARDIAN/SENIOR
  테이블에는 password 컬럼을 두지 않고, 프로필/임상 메타데이터만 저장한다.
- GUARDIAN.guardian_id / SENIOR.senior_id 는 Supabase auth.users.id(UUID)와 동일한 값을 사용한다.
- 초대링크(INVITE) 검증과 만료 처리는 애플리케이션 레이어(여기)에서 수행한다. (요구사항 17번)
"""

import random
import string
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_guardian, get_current_user_id
from app.core.supabase_client import supabase, supabase_admin
from app.models.models import Guardian, GuardianSenior, Invite, LinkStatus, ReconnectCode, Senior
from app.schemas.auth import (
    GuardianRegisterRequest,
    GuardianResponse,
    GuardianSeniorResponse,
    InviteCreateRequest,
    InviteCreateResponse,
    InviteListItemResponse,
    InviteVerifyResponse,
    LinkStatusUpdateRequest,
    LoginRequest,
    MeResponse,
    ReconnectCodeResponse,
    ReconnectRequest,
    ReconnectResponse,
    SeniorRegisterRequest,
    SeniorResponse,
    FCMTokenRegisterRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])

INVITE_EXPIRE_HOURS = 72

# 초대 코드 생성용 문자 집합: 혼동되기 쉬운 0/O, 1/I 는 제외
INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
INVITE_CODE_PART_LEN = 3  # 'XXX-XXX' 형태 -> 한 파트당 3자리


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


def _generate_invite_code_part() -> str:
    return "".join(random.choices(INVITE_CODE_CHARS, k=INVITE_CODE_PART_LEN))


def generate_unique_invite_code(db: Session) -> str:
    """
    'MOA-DEV' 같은 'XXX-XXX' 형태(영문/숫자 6자리 + 하이픈)의
    초대 코드를 DB 중복 없이 생성한다.
    """
    while True:
        code = f"{_generate_invite_code_part()}-{_generate_invite_code_part()}"
        exists = db.query(Invite).filter(Invite.token == code).first()
        if not exists:
            return code


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


@router.get("/me", response_model=MeResponse)
def get_me(
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """access_token만으로 현재 로그인한 사용자의 role / name / user_id를 반환한다.

    FE가 앱 재시작·새로고침 후 세션을 복원할 때 사용한다.
    guardian/senior 어느 역할이든 하나의 토큰으로 호출 가능하다.
    """
    guardian = db.query(Guardian).filter(Guardian.guardian_id == user_id).first()
    if guardian is not None:
        return MeResponse(role="guardian", name=guardian.name, user_id=user_id)

    senior = db.query(Senior).filter(Senior.senior_id == user_id).first()
    if senior is not None:
        return MeResponse(role="senior", name=senior.name, user_id=user_id)

    raise HTTPException(status_code=404, detail="가입된 프로필을 찾을 수 없습니다.")


# ---------------------------------------------------------------------------
# 초대링크 (요구사항 3, 17번)
# ---------------------------------------------------------------------------

@router.post("/invite", response_model=InviteCreateResponse)
def create_invite(
    req: InviteCreateRequest,
    db: Session = Depends(get_db),
    guardian: Guardian = Depends(get_current_guardian),
):
    """초대 코드 생성. 토큰의 보호자 본인 명의로 발급한다.

    코드 형식: 'XXX-XXX' (영문 대문자 + 숫자, 혼동 문자 제외, 6자리 + 하이픈)
    예) MOA-DEV
    """
    code = generate_unique_invite_code(db)

    invite = Invite(
        token=code,
        guardian_id=guardian.guardian_id,
        senior_name=req.senior_name,
        expired_at=datetime.utcnow() + timedelta(hours=INVITE_EXPIRE_HOURS),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite


@router.get("/invite/{token}/verify", response_model=InviteVerifyResponse)
def verify_invite(token: str, db: Session = Depends(get_db)):
    # 사용자가 'moa-dev'처럼 소문자로 입력하거나 공백을 넣어도 인식되도록 정규화
    normalized_token = token.strip().upper()

    invite = db.query(Invite).filter(Invite.token == normalized_token).first()

    if invite is None:
        return InviteVerifyResponse(valid=False, reason="NOT_FOUND")
    if invite.is_used:
        return InviteVerifyResponse(valid=False, reason="USED")
    if invite.expired_at < datetime.utcnow():
        return InviteVerifyResponse(valid=False, reason="EXPIRED")

    guardian = db.query(Guardian).filter(Guardian.guardian_id == invite.guardian_id).first()
    return InviteVerifyResponse(valid=True, guardian_name=guardian.name if guardian else None)


@router.get("/guardian/invites", response_model=list[InviteListItemResponse])
def list_invites_for_guardian(
    db: Session = Depends(get_db),
    guardian: Guardian = Depends(get_current_guardian),
):
    """로그인한 보호자가 발급한 초대 토큰 전체 목록(미사용/사용됨 포함).

    B-3 대응: BE에는 PENDING 링크가 존재하지 않는다. GuardianSenior 연동은
    senior가 가입하는 순간 바로 ACTIVE로 생성되므로, FE의 '연결 대기 카드'는
    이 목록에서 is_used=False 이고 expired_at이 아직 지나지 않은 항목을
    기준으로 표시해야 한다. (PENDING 링크가 아니라 '미사용 초대 토큰' 기준)
    """
    invites = (
        db.query(Invite)
        .filter(Invite.guardian_id == guardian.guardian_id)
        .order_by(Invite.created_at.desc())
        .all()
    )
    return invites


# ---------------------------------------------------------------------------
# 고령층 회원가입 (초대링크 기반) — 요구사항 3, 4번
# ---------------------------------------------------------------------------

@router.post("/senior/register", response_model=SeniorResponse)
def register_senior(req: SeniorRegisterRequest, db: Session = Depends(get_db)):
    normalized_token = req.invite_token.strip().upper()

    invite = db.query(Invite).filter(Invite.token == normalized_token).first()

    if invite is None:
        raise HTTPException(status_code=404, detail="초대코드를 찾을 수 없습니다.")
    if invite.is_used:
        raise HTTPException(status_code=400, detail="이미 사용된 초대코드입니다.")
    if invite.expired_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="만료된 초대코드입니다. 재발송을 요청해주세요.")

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

    senior_ids = [link.senior_id for link in links]
    seniors = db.query(Senior).filter(Senior.senior_id.in_(senior_ids)).all()
    senior_name_map = {s.senior_id: s.name for s in seniors}

    return [
        GuardianSeniorResponse(
            link_id=link.link_id,
            guardian_id=link.guardian_id,
            senior_id=link.senior_id,
            senior_name=senior_name_map.get(link.senior_id),
            link_status=link.link_status,
            linked_at=link.linked_at,
        )
        for link in links
    ]


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


# ---------------------------------------------------------------------------
# 고령층 재연결 코드 — 요구사항: 고령층 재로그인
# 고령층은 랜덤 이메일/비번으로 가입되어 비밀번호 로그인이 불가능하다.
# 보호자가 재연결 코드를 발급하고, 고령층이 입력하면 매직링크 세션으로 교환한다.
# ---------------------------------------------------------------------------

RECONNECT_EXPIRE_HOURS = 1


def _generate_unique_reconnect_code(db: Session) -> str:
    while True:
        code = f"{_generate_invite_code_part()}-{_generate_invite_code_part()}"
        if not db.query(ReconnectCode).filter(ReconnectCode.code == code).first():
            return code


@router.post("/senior/{senior_id}/reconnect-code", response_model=ReconnectCodeResponse)
def create_reconnect_code(
    senior_id: UUID,
    db: Session = Depends(get_db),
    guardian: Guardian = Depends(get_current_guardian),
):
    """보호자가 담당 고령층의 재연결 코드 발급. ACTIVE 연동 관계가 있어야만 발급 가능."""
    link = (
        db.query(GuardianSenior)
        .filter(
            GuardianSenior.guardian_id == guardian.guardian_id,
            GuardianSenior.senior_id == senior_id,
            GuardianSenior.link_status == LinkStatus.ACTIVE.value,
        )
        .first()
    )
    if link is None:
        raise HTTPException(status_code=403, detail="연동된 고령층이 아닙니다.")

    code = _generate_unique_reconnect_code(db)
    reconnect = ReconnectCode(
        code=code,
        senior_id=senior_id,
        guardian_id=guardian.guardian_id,
        expired_at=datetime.utcnow() + timedelta(hours=RECONNECT_EXPIRE_HOURS),
    )
    db.add(reconnect)
    db.commit()
    db.refresh(reconnect)
    return reconnect


@router.post("/senior/reconnect", response_model=ReconnectResponse)
def reconnect_senior(req: ReconnectRequest, db: Session = Depends(get_db)):
    """고령층이 재연결 코드로 세션 발급. 인증 불필요 (로그아웃 상태에서 호출).

    내부 흐름:
    1) admin.generate_link(magiclink) → hashed_token 추출 (이메일 미전송)
    2) verify_otp(token_hash) → access_token / refresh_token 획득
    3) 코드 is_used = True 마킹 후 토큰 반환
    """
    normalized = req.code.strip().upper()
    reconnect = db.query(ReconnectCode).filter(ReconnectCode.code == normalized).first()

    if reconnect is None:
        raise HTTPException(status_code=404, detail="재연결 코드를 찾을 수 없습니다.")
    if reconnect.is_used:
        raise HTTPException(status_code=400, detail="이미 사용된 재연결 코드입니다.")
    if reconnect.expired_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="만료된 재연결 코드입니다. 보호자에게 재발급을 요청해주세요.")

    senior = db.query(Senior).filter(Senior.senior_id == reconnect.senior_id).first()
    if senior is None:
        raise HTTPException(status_code=404, detail="고령층 정보를 찾을 수 없습니다.")

    try:
        # 매직링크 생성 — 이메일은 보내지 않고 hashed_token만 추출 (service_role 필수)
        link_res = supabase_admin.auth.admin.generate_link({
            "type": "magiclink",
            "email": senior.email,
        })
        hashed_token = link_res.properties.hashed_token

        # hashed_token으로 OTP 검증 → 세션 획득
        session_res = supabase.auth.verify_otp({
            "token_hash": hashed_token,
            "type": "magiclink",
        })
        session = session_res.session
        if session is None:
            raise HTTPException(status_code=500, detail="세션 발급에 실패했습니다.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"재연결 세션 발급 실패: {e}")

    reconnect.is_used = True
    db.commit()

    return ReconnectResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        role="senior",
        name=senior.name,
    )


@router.post("/fcm-token")
def register_fcm_token(
    req: FCMTokenRegisterRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """현재 로그인한 사용자(보호자 혹은 고령자)의 FCM 토큰을 저장/업데이트한다."""
    guardian = db.query(Guardian).filter(Guardian.guardian_id == user_id).first()
    if guardian is not None:
        guardian.fcm_token = req.fcm_token
        db.commit()
        return {"status": "success", "message": "보호자 FCM 토큰이 등록되었습니다."}

    senior = db.query(Senior).filter(Senior.senior_id == user_id).first()
    if senior is not None:
        senior.fcm_token = req.fcm_token
        db.commit()
        return {"status": "success", "message": "고령자 FCM 토큰이 등록되었습니다."}

    raise HTTPException(status_code=404, detail="가입된 프로필을 찾을 수 없습니다.")
