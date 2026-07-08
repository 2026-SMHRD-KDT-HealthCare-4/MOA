"""add session_id to voice_feature

chatbot 대화 세션 종료 시 세션 단위로 RiskPrediction 1건을 생성하기 위해,
VoiceFeature 행과 ChatSession 을 연결하는 session_id 컬럼을 추가한다.

- nullable=True: SCRIPT 경로나 세션 없이 호출된 CHATBOT 행은 NULL 허용
- FK 없음: DRP 물리 분리 대비 (chat_session 이 FK 없이 관리되는 것과 동일한 규칙)

Revision ID: e1f2a3b4c5d6
Revises: d3e4f5a6b7c8
Create Date: 2026-07-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = "d3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "voice_feature",
        sa.Column("session_id", sa.UUID(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("voice_feature", "session_id")
