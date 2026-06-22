"""add reconnect_code table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-22

ReconnectCode: 보호자가 발급하는 고령층 재연결 코드. 형식은 XXX-XXX, 유효기간 1시간.
고령층은 랜덤 자격증명으로 가입되어 비밀번호 로그인이 불가능하므로 이 코드가 유일한 재로그인 수단.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c3d4e5f6a7b8"
down_revision: str = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reconnect_code",
        sa.Column("code", sa.String(7), primary_key=True),
        sa.Column(
            "senior_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("senior.senior_id"),
            nullable=False,
        ),
        sa.Column(
            "guardian_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("guardian.guardian_id"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("expired_at", sa.DateTime(), nullable=False),
        sa.Column("is_used", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_table("reconnect_code")
