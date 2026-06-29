"""drop medication_check table

복약 체크(이행 기록) 기능을 사용하지 않기로 팀에서 협의함에 따라
medication_check 테이블을 제거한다. 복약 알림(medication_reminder) 기능은
그대로 유지되며, 알림 완료 처리는 reminder.status="COMPLETED"로만 수행된다.

Revision ID: a9b0c1d2e3f4
Revises: d7c21f38a71a
Create Date: 2026-06-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a9b0c1d2e3f4"
down_revision: Union[str, Sequence[str], None] = "d7c21f38a71a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 복약 체크 기능 미사용 — 테이블 제거.
    # (안전장치) 일부 환경에 테이블이 없을 수 있으므로 존재할 때만 드롭한다.
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "medication_check" in insp.get_table_names():
        op.drop_table("medication_check")


def downgrade() -> None:
    # 롤백 시 원래 스키마(초기 마이그레이션과 동일)로 테이블을 복구한다.
    op.create_table(
        "medication_check",
        sa.Column("check_id", sa.UUID(), nullable=False),
        sa.Column("medication_id", sa.UUID(), nullable=False),
        sa.Column("senior_id", sa.UUID(), nullable=False),
        sa.Column("check_date", sa.Date(), nullable=False),
        sa.Column("is_completed", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["medication_id"], ["medication.medication_id"]),
        sa.ForeignKeyConstraint(["senior_id"], ["senior.senior_id"]),
        sa.PrimaryKeyConstraint("check_id"),
        sa.UniqueConstraint("medication_id", "check_date", name="uq_medication_check_date"),
    )