"""add senior-only medication reminder state

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-06-24
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "a7b8c9d0e1f2"
down_revision = "e6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "medication_reminder",
        sa.Column("reminder_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("medication_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("medication.medication_id"), nullable=False),
        sa.Column("senior_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("senior.senior_id"), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="PENDING"),
        sa.Column("reminder_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("retry_at", sa.DateTime(), nullable=True),
        sa.Column("opened_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint(
            "status IN ('PENDING','REMINDER_SCHEDULED','COMPLETED')",
            name="ck_medication_reminder_status",
        ),
        sa.UniqueConstraint("medication_id", "scheduled_for", name="uq_medication_reminder_schedule"),
    )
    op.create_index("ix_medication_reminder_senior_scheduled", "medication_reminder", ["senior_id", "scheduled_for"])
    op.create_index("ix_medication_reminder_retry", "medication_reminder", ["status", "retry_at"])


def downgrade() -> None:
    op.drop_index("ix_medication_reminder_retry", table_name="medication_reminder")
    op.drop_index("ix_medication_reminder_senior_scheduled", table_name="medication_reminder")
    op.drop_table("medication_reminder")
