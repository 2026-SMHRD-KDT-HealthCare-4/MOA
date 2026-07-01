"""drop documents table (unused RAG vector store)

RAG 방식 변경으로 더 이상 사용하지 않는 documents 테이블과 match_documents 함수를 제거한다.
- 도입: e8a94cb2071a(add_pgvector_documents) 에서 LangChain VectorStore 용으로 생성.
- 현재: 런타임 코드에서 documents 테이블/match_documents RPC 를 호출하는 곳이 없음.
  장기 기억은 chat_session(텍스트) 시간순 조회로 대체되어 벡터 검색을 쓰지 않는다.

주의: pgvector 확장(vector)은 드롭하지 않는다. 확장 제거는 위험 범위가 넓고(다른 객체
      영향 가능), 되돌리기가 번거롭다. 테이블/함수만 정리한다.

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-07-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, Sequence[str], None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # RAG 시맨틱 조회 함수 먼저 제거(테이블에 의존).
    op.execute("DROP FUNCTION IF EXISTS match_documents(vector, float, int, jsonb);")
    # 혹시 시그니처가 다른 형태로 남아있을 경우 대비한 보조 드롭.
    op.execute("DROP FUNCTION IF EXISTS match_documents;")
    # documents 테이블 제거.
    op.execute("DROP TABLE IF EXISTS documents;")
    # pgvector 확장(vector)은 남겨둔다. (주석 참조)


def downgrade() -> None:
    # 롤백 시 documents 테이블과 match_documents 함수를 원본과 동일하게 복구.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS documents (
            id bigserial PRIMARY KEY,
            content text,
            metadata jsonb,
            embedding vector(1536)
        );
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION match_documents (
          query_embedding vector(1536),
          match_threshold float,
          match_count int,
          filter jsonb DEFAULT '{}'
        ) RETURNS TABLE (
          id bigint,
          content text,
          metadata jsonb,
          similarity float
        ) LANGUAGE plpgsql AS $$
        BEGIN
          RETURN QUERY
          SELECT
            documents.id,
            documents.content,
            documents.metadata,
            1 - (documents.embedding <=> query_embedding) AS similarity
          FROM documents
          WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
            AND (filter @> documents.metadata OR filter = '{}')
          ORDER BY documents.embedding <=> query_embedding
          LIMIT match_count;
        END;
        $$;
        """
    )