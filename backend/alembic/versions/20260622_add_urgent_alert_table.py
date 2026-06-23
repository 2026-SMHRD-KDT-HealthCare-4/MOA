"""add urgent_alert table

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a7b8
Create Date: 2026-06-22

UrgentAlert: 챗봇 발화 긴급 키워드 감지 시 생성되는 알림 후보 레코드.
ZDR 원칙에 따라 발화 원문은 저장하지 않는다 (level, rule_id, 발생시각만 저장).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d5e6f7a8b9c0"
down_revision: str = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "urgent_alert",
        sa.Column(
            "alert_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "senior_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("senior.senior_id"),
            nullable=False,
        ),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("level", sa.String(20), nullable=False),
        sa.Column("rule_id", sa.String(50), nullable=True),
        sa.Column("alert_status", sa.String(10), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "level IN ('SUICIDE_RISK','MEDICAL_EMERGENCY')",
            name="ck_urgent_alert_level",
        ),
        sa.CheckConstraint(
            "alert_status IN ('pending','cancelled','sent')",
            name="ck_urgent_alert_status",
        ),
    )


def downgrade() -> None:
    op.drop_table("urgent_alert")
