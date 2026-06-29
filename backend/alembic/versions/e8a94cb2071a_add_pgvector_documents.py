"""add_pgvector_documents

Revision ID: e8a94cb2071a
Revises: d7c21f38a71a
Create Date: 2026-06-29 12:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8a94cb2071a'
down_revision: Union[str, None] = 'a9b0c1d2e3f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. pgvector 확장 활성화
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    
    # 2. documents 테이블 생성 (LangChain VectorStore 대응)
    op.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id bigserial PRIMARY KEY,
        content text,
        metadata jsonb,
        embedding vector(1536)
    );
    """)
    
    # 3. match_documents RPC 함수 생성 (RAG 시맨틱 조회를 위함)
    op.execute("""
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
    """)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS match_documents;")
    op.execute("DROP TABLE IF EXISTS documents;")
    op.execute("DROP EXTENSION IF EXISTS vector;")
