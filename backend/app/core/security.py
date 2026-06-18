"""
Supabase Auth가 발급한 JWT를 검증하기 위한 FastAPI 의존성.

비밀번호 해싱/자체 JWT 발급은 더 이상 사용하지 않는다(Supabase Auth가 전담).
보호된 라우트는 아래 의존성을 Depends로 사용한다.
- get_current_user_id        : 토큰에서 user_id(UUID)만 꺼낸다 (역할 무관).
- get_current_guardian       : user_id가 GUARDIAN 테이블에 있는지 확인하고 Guardian 반환.
- get_current_senior         : user_id가 SENIOR 테이블에 있는지 확인하고 Senior 반환.
- verify_guardian_senior_link: 보호자가 특정 senior에 ACTIVE로 연동돼 있는지 검증.

토큰 검증 방식
- Supabase 신형 프로젝트는 JWT를 ES256(비대칭키)으로 서명한다. 이 경우 검증에는
  Supabase가 공개한 JWKS(공개키 모음)를 사용한다.
  JWKS 위치: {SUPABASE_URL}/auth/v1/.well-known/jwks.json
- 구형 프로젝트(HS256 + 공유 secret)와의 호환을 위해, 토큰 헤더의 alg가 HS256이면
  SUPABASE_JWT_SECRET 으로 검증하는 경로도 유지한다.

NOTE: .env 에 SUPABASE_URL 이 필요하다(JWKS 조회용). HS256 호환을 쓰려면
      SUPABASE_JWT_SECRET 도 채운다.
"""

import os
from uuid import UUID

import httpx
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.database import get_db

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

bearer_scheme = HTTPBearer()

# JWKS(공개키 모음)를 매 요청마다 받아오지 않도록 메모리에 캐시한다.
_jwks_cache: dict | None = None


def _get_jwks() -> dict:
    """Supabase JWKS(공개키 모음)를 가져온다. 한 번 받아오면 캐시한다."""
    global _jwks_cache
    if _jwks_cache is None:
        url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        resp = httpx.get(url, timeout=10.0)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache


def _decode_token(token: str) -> dict:
    """토큰을 검증하고 payload를 반환한다. 실패하면 JWTError를 던진다.

    토큰 헤더의 alg를 보고 ES256(JWKS) 또는 HS256(공유 secret) 경로를 선택한다.
    """
    header = jwt.get_unverified_header(token)
    alg = header.get("alg", "")

    if alg == "HS256":
        # 구형 방식: 공유 secret으로 검증
        if not SUPABASE_JWT_SECRET:
            raise JWTError("HS256 토큰이지만 SUPABASE_JWT_SECRET이 설정되지 않았습니다.")
        return jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )

    # 신형 방식(ES256 등): JWKS의 공개키 중 kid가 일치하는 것으로 검증
    jwks = _get_jwks()
    kid = header.get("kid")
    key = None
    for k in jwks.get("keys", []):
        if k.get("kid") == kid:
            key = k
            break

    if key is None:
        # 캐시가 오래돼 키가 회전됐을 수 있으니 한 번 갱신 후 재시도
        global _jwks_cache
        _jwks_cache = None
        jwks = _get_jwks()
        for k in jwks.get("keys", []):
            if k.get("kid") == kid:
                key = k
                break

    if key is None:
        raise JWTError("토큰 서명에 맞는 공개키(JWKS)를 찾지 못했습니다.")

    return jwt.decode(
        token,
        key,
        algorithms=[alg],
        audience="authenticated",
    )


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> UUID:
    """Authorization: Bearer <supabase_access_token> 헤더를 검증하고 user_id를 반환한다."""
    token = credentials.credentials
    try:
        payload = _decode_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않거나 만료된 토큰입니다.",
        )
    except Exception:
        # JWKS 조회 실패 등 예기치 못한 오류도 인증 실패로 처리
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰 검증 중 오류가 발생했습니다.",
        )

    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="토큰에 사용자 정보가 없습니다.")

    return UUID(sub)


def get_current_guardian(
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """토큰의 user_id가 보호자 계정인지 확인하고 Guardian 객체를 반환한다.

    보호자 전용 엔드포인트에서 사용. 클라이언트가 보낸 guardian_id를 신뢰하는 대신
    토큰에서 본인 식별 정보를 확정하기 위한 것이다.
    """
    # 순환 import 방지를 위해 함수 내부에서 모델 import
    from app.models.models import Guardian

    guardian = db.query(Guardian).filter(Guardian.guardian_id == user_id).first()
    if guardian is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="보호자 권한이 필요합니다.",
        )
    return guardian


def get_current_senior(
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """토큰의 user_id가 고령층 계정인지 확인하고 Senior 객체를 반환한다."""
    from app.models.models import Senior

    senior = db.query(Senior).filter(Senior.senior_id == user_id).first()
    if senior is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="고령층 권한이 필요합니다.",
        )
    return senior


def verify_guardian_senior_link(
    guardian_id: UUID, senior_id: UUID, db: Session
) -> None:
    """보호자가 해당 고령층에 ACTIVE로 연동돼 있는지 검증한다. 아니면 403.

    보호자가 자신과 연동되지 않은 고령층의 데이터에 접근하는 것을 차단한다.
    엔드포인트 함수 안에서 호출한다 (경로/본문에서 받은 senior_id 검증용).
    """
    from app.models.models import GuardianSenior, LinkStatus

    link = (
        db.query(GuardianSenior)
        .filter(
            GuardianSenior.guardian_id == guardian_id,
            GuardianSenior.senior_id == senior_id,
            GuardianSenior.link_status == LinkStatus.ACTIVE.value,
        )
        .first()
    )
    if link is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 고령층에 대한 접근 권한이 없습니다.",
        )


def verify_senior_access(user_id: UUID, senior_id: UUID, db: Session) -> None:
    """user_id가 해당 senior에 접근 가능한지 검증한다 (본인이거나 ACTIVE 연동 보호자).

    복약/알림/리포트처럼 고령층 본인과 연동 보호자 양쪽이 접근하는 엔드포인트에서 사용한다.
    """
    # 본인이면 통과
    if user_id == senior_id:
        return

    # 본인이 아니면 연동 보호자인지 확인
    from app.models.models import GuardianSenior, LinkStatus

    link = (
        db.query(GuardianSenior)
        .filter(
            GuardianSenior.guardian_id == user_id,
            GuardianSenior.senior_id == senior_id,
            GuardianSenior.link_status == LinkStatus.ACTIVE.value,
        )
        .first()
    )
    if link is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 고령층의 데이터에 접근할 권한이 없습니다.",
        )
