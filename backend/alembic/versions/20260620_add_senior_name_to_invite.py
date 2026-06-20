"""add senior_name to invite

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-20

senior_name: 보호자가 부르는 호칭("엄마").
Senior.name(본인 실명, 의료/리포트용)과 별개이며 보호자 화면/알림 표시 전용.
"""

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: str = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invite", sa.Column("senior_name", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("invite", "senior_name")
