"""add family_group and guardian_member tables for co-guardian feature

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-06-25

Supabase SQL Editor에서 아래 SQL을 순서대로 실행한다.
(alembic upgrade head는 사용하지 않음 — 공유 Supabase DB는 SQL Editor에서 직접 실행)

이 마이그레이션의 테이블 생성/백필은 Supabase SQL Editor에서 직접 적용했다.
따라서 upgrade()/downgrade()는 비워 두고, 로컬에서는
`alembic stamp f7a8b9c0d1e2` 로 적용 표시만 맞춘다.
(여기서 op.create_table 을 두면 alembic upgrade head 시 "relation already exists" 충돌)

---- SQL START ----

CREATE TABLE family_group (
    family_group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    created_by_guardian_id UUID NOT NULL REFERENCES guardian(guardian_id),
    status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','REVOKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE guardian_member (
    guardian_member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id UUID NOT NULL REFERENCES family_group(family_group_id),
    guardian_id UUID REFERENCES guardian(guardian_id),
    guardian_name VARCHAR(100) NOT NULL,
    member_role VARCHAR(20) NOT NULL
        CHECK (member_role IN ('OWNER','SUB_GUARDIAN')),
    status VARCHAR(10) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','ACTIVE','REVOKED')),
    invited_by_guardian_id UUID REFERENCES guardian(guardian_id),
    invite_code VARCHAR(8) UNIQUE,
    invite_expires_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 기존 보호자 백필: guardian마다 가족 그룹 1개 + OWNER 멤버 1개 생성
-- (실제 적용본은 멱등 + is_deleted 제외 버전을 SQL Editor에서 실행함)
INSERT INTO family_group (name, created_by_guardian_id, status, created_at, updated_at)
SELECT name || ' 가족', guardian_id, 'ACTIVE', now(), now()
FROM guardian;

INSERT INTO guardian_member
    (family_group_id, guardian_id, guardian_name, member_role, status, joined_at, created_at)
SELECT fg.family_group_id, g.guardian_id, g.name, 'OWNER', 'ACTIVE', now(), now()
FROM guardian g
JOIN family_group fg ON fg.created_by_guardian_id = g.guardian_id;

---- SQL END ----
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "f7a8b9c0d1e2"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # family_group / guardian_member 테이블과 백필은 공유 Supabase DB에
    # SQL Editor로 이미 직접 적용함 (상단 주석 SQL 참고).
    # 여기서 op.create_table 을 호출하면 "relation already exists" 충돌이 나므로 비워 둔다.
    # 로컬/CI 에서는 `alembic stamp f7a8b9c0d1e2` 로 적용 상태만 맞춘다.
    pass


def downgrade() -> None:
    # 수동 적용 마이그레이션이라 자동 롤백하지 않는다.
    # 되돌리려면 SQL Editor에서 직접:
    #   DROP TABLE guardian_member;
    #   DROP TABLE family_group;
    pass