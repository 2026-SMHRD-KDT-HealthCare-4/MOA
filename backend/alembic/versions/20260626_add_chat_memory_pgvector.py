"""add chat_memory table with pgvector for long-term memory

챗봇 장기 기억(실시간 임베딩) 기능을 위한 테이블을 추가한다.
pgvector 확장을 활성화하고, 발화 임베딩을 저장할 chat_memory 테이블과
유사도 검색용 벡터 인덱스를 생성한다.

[정책 합의 2026-06-26]
- 전부 저장 / 30일 보관(스케줄러 자동삭제) / 능동삭제 미구현 + 탈퇴 시 코드 삭제
- chat_session 과 동일하게 senior_id 에 FK 미설정 (물리 분리 대비)

Revision ID: b1c2d3e4f5a6
Revises: e8a94cb2071a
Create Date: 2026-06-26

[체인 메모] 윤현 님의 e8a94cb2071a(add_pgvector_documents) 뒤에 이어 붙인다.
그 마이그레이션이 pgvector 확장을 이미 켜고 documents 테이블(RAG용)을 만드므로,
우리는 그 다음 단계로 chat_memory(챗봇 대화 기억) 테이블을 추가한다. 용도가 달라 공존 가능.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "e8a94cb2071a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. pgvector 확장 활성화 (Supabase는 지원하지만 명시적으로 켠다)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # 2. chat_memory 테이블 생성
    #    embedding 은 vector(1536) — text-embedding-3-small 차원.
    #    senior_id 에 FK 를 걸지 않는다(chat_session 과 동일한 물리분리 대비 설계).
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

    # 3. 조회 인덱스
    #    (a) senior_id + created_at: 30일 자동삭제 배치 및 사용자별 조회용
    op.create_index(
        "ix_chat_memory_senior_created",
        "chat_memory",
        ["senior_id", "created_at"],
    )
    #    (b) 벡터 유사도 검색 인덱스 (코사인 거리). ivfflat 사용.
    #        lists 값은 데이터량에 맞춰 추후 조정 가능(초기 100).
    op.execute(
        "CREATE INDEX ix_chat_memory_embedding "
        "ON chat_memory USING ivfflat (embedding vector_cosine_ops) "
        "WITH (lists = 100)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_chat_memory_embedding")
    op.drop_index("ix_chat_memory_senior_created", table_name="chat_memory")
    op.execute("DROP TABLE IF EXISTS chat_memory")
    # 확장(vector)은 다른 곳에서도 쓸 수 있으므로 드롭하지 않는다.