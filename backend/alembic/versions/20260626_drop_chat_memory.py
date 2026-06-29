"""drop chat_memory table

장기 기억 방식을 변경함에 따라 chat_memory 테이블을 제거한다.
- 변경 전: 발화를 임베딩(pgvector)하여 chat_memory 에 저장 후 유사도 검색
- 변경 후: 이미 대화를 저장 중인 chat_session(텍스트)을 시간순으로 조회해
  장기 기억으로 사용한다. 임베딩/벡터 검색을 쓰지 않으므로 chat_memory 가 불필요.

주의: pgvector 확장(vector)은 윤현 님의 documents 테이블(RAG)이 사용하므로 드롭하지 않는다.

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-06-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 인덱스 먼저 제거 후 테이블 드롭 (존재할 때만)
    op.execute("DROP INDEX IF EXISTS ix_chat_memory_embedding")
    op.execute("DROP INDEX IF EXISTS ix_chat_memory_senior_created")
    op.execute("DROP TABLE IF EXISTS chat_memory")
    # pgvector 확장은 documents(RAG)가 사용하므로 남겨둔다.


def downgrade() -> None:
    # 롤백 시 chat_memory 를 다시 만든다(변경 전 스키마와 동일).
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_memory (
            memory_id   UUID PRIMARY KEY,
            senior_id   UUID NOT NULL,
            session_id  UUID,
            content     TEXT NOT NULL,
            embedding   vector(1536) NOT NULL,
            created_at  TIMESTAMP NOT NULL DEFAULT now()
        )
        """
    )
    op.create_index(
        "ix_chat_memory_senior_created",
        "chat_memory",
        ["senior_id", "created_at"],
    )
    op.execute(
        "CREATE INDEX ix_chat_memory_embedding "
        "ON chat_memory USING ivfflat (embedding vector_cosine_ops) "
        "WITH (lists = 100)"
    )