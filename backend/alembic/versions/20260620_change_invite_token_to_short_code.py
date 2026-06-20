"""change invite token to XXX-XXX short code

Revision ID: a1b2c3d4e5f6
Revises: 20751b93fd22
Create Date: 2026-06-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "20751b93fd22"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # UUID 초대 토큰은 XXX-XXX와 호환되지 않는다. 기존 미사용 토큰은 폐기하고 재발급한다.
    op.execute("DELETE FROM invite")
    op.alter_column(
        "invite",
        "token",
        existing_type=postgresql.UUID(),
        type_=sa.String(7),
        postgresql_using="token::text",
    )


def downgrade() -> None:
    op.execute("DELETE FROM invite")
    op.alter_column(
        "invite",
        "token",
        existing_type=sa.String(7),
        type_=postgresql.UUID(),
        postgresql_using="token::uuid",
    )
