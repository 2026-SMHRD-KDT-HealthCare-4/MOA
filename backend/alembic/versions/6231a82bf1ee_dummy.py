"""dummy revision to resolve desync

Revision ID: 6231a82bf1ee
Revises: f7a8b9c0d1e2
Create Date: 2026-06-26

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '6231a82bf1ee'
down_revision = 'f7a8b9c0d1e2'
branch_labels = None
depends_on = None

def upgrade() -> None:
    pass

def downgrade() -> None:
    pass
