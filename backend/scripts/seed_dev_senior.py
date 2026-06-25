"""
DEV 전용: 고정 직접사용자(senior) 테스트 계정 시드.

목적
- 챗봇/직접사용자 화면을 real 백엔드로 반복 테스트할 때, 매번 초대코드를
  클레임하지 않고 '알려진 이메일/비밀번호'로 로그인할 수 있게 한다.
- 로그인 화면에서 이 계정으로 로그인하면 role=senior 라 직접사용자 화면으로 진입한다.

안전성
- DB 스키마를 바꾸지 않는다. 기존 senior 테이블에 데이터 1행만 추가한다.
- 멱등(idempotent): 이미 있으면 아무 것도 하지 않는다. 여러 번 실행해도 안전.
- senior_id = Supabase auth.users.id 규칙을 그대로 지킨다(등록 흐름과 동일).

실행 (backend 디렉터리에서, .env 가 채워진 상태):
    venv/Scripts/python.exe scripts/seed_dev_senior.py        # Windows
    python scripts/seed_dev_senior.py                          # 기타

주의
- 이 계정은 '공유 Supabase DB'에 만들어진다. 팀이 같은 DB를 보면 한 번만
  실행하면 모두가 같은 계정으로 로그인할 수 있다. (코드 머지만으로는 안 생기고,
  누군가 이 스크립트를 1회 실행해야 한다.)
"""

import os
import sys
from datetime import datetime

# backend 루트를 import 경로에 추가 (어느 위치에서 실행해도 app.* 임포트되도록)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal  # noqa: E402  (.env load 포함)
from app.core.supabase_client import supabase_admin  # noqa: E402
from app.models.models import Senior  # noqa: E402

# --- 고정 테스트 계정 값 (필요하면 여기만 수정) ---------------------------------
SEED_EMAIL = "elder.dev@moa.app"
SEED_PASSWORD = "moa00000"
SEED_NAME = "테스트직접사용자"
SEED_BIRTH_DATE = datetime(1950, 1, 1)
SEED_GENDER = "F"  # CheckConstraint: 'M' | 'F'
SEED_PHONE = "010-0000-0000"


def _find_supabase_user_id_by_email(email: str) -> str | None:
    """이미 존재하는 Supabase Auth 유저의 id 를 이메일로 찾는다(부분 상태 복구용)."""
    try:
        result = supabase_admin.auth.admin.list_users()
    except Exception:
        return None
    # gotrue 버전에 따라 list 또는 .users 형태일 수 있어 모두 대응
    users = result if isinstance(result, list) else getattr(result, "users", []) or []
    for user in users:
        if getattr(user, "email", None) == email:
            return getattr(user, "id", None)
    return None


def _ensure_supabase_user() -> str:
    """Supabase Auth 유저를 보장하고 id 를 반환. 이미 있으면 그 id 재사용."""
    try:
        res = supabase_admin.auth.admin.create_user(
            {
                "email": SEED_EMAIL,
                "password": SEED_PASSWORD,
                "email_confirm": True,  # 이메일 확인 없이 즉시 로그인 가능
                "user_metadata": {"role": "senior", "name": SEED_NAME},
            }
        )
        user = getattr(res, "user", None) or res
        user_id = getattr(user, "id", None)
        if user_id:
            print(f"  · Supabase Auth 유저 생성됨: {user_id}")
            return user_id
    except Exception as e:
        # 이미 가입된 이메일 등 → 기존 유저 id 를 찾아 재사용
        print(f"  · create_user 건너뜀({e}); 기존 유저 조회 시도")

    existing = _find_supabase_user_id_by_email(SEED_EMAIL)
    if existing:
        print(f"  · 기존 Supabase Auth 유저 재사용: {existing}")
        return existing
    raise SystemExit("Supabase Auth 유저를 생성/조회하지 못했습니다. .env(SERVICE_ROLE_KEY) 확인 필요.")


def main() -> None:
    db = SessionLocal()
    try:
        existing = db.query(Senior).filter(Senior.email == SEED_EMAIL).first()
        if existing is not None:
            print(f"[skip] 이미 시드된 계정입니다: {SEED_EMAIL} (senior_id={existing.senior_id})")
            return

        from uuid import UUID

        print(f"[seed] 고정 직접사용자 계정 생성: {SEED_EMAIL}")
        user_id = _ensure_supabase_user()

        senior = Senior(
            senior_id=UUID(str(user_id)),
            email=SEED_EMAIL,
            name=SEED_NAME,
            birth_date=SEED_BIRTH_DATE,
            gender=SEED_GENDER,
            phone=SEED_PHONE,
            biometric_consent_yn=True,
            consent_at=datetime.utcnow(),
        )
        db.add(senior)
        db.commit()
        print("[done] senior 행 추가 완료")
        print("-" * 48)
        print(f"  로그인 이메일 : {SEED_EMAIL}")
        print(f"  비밀번호      : {SEED_PASSWORD}")
        print("  → 로그인 화면에서 이 계정으로 로그인하면 직접사용자 화면으로 진입합니다.")
        print("-" * 48)
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
