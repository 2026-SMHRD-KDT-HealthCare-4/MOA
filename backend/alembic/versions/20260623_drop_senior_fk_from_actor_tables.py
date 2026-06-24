"""drop senior FK from actor tables (allow guardian as actor)

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-06-23

보호자(guardian)도 음성 분석·낭독 기록·챗봇 대화를 사용할 수 있도록,
script_record / voice_feature / risk_prediction 테이블의 senior_id FK 제약을 제거한다.

guardian.guardian_id 는 senior 테이블에 없으므로 FK 제약이 있으면 INSERT 실패.
ORM 선언(ForeignKey)은 관계 설정용이므로 유지하되, DB 레벨 제약만 제거한다.
chat_session.senior_id 는 처음부터 FK 미설정(물리 분리 대비)이므로 변경 불필요.
"""

from alembic import op

revision: str = "e6f7a8b9c0d1"
down_revision: str = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None

# PostgreSQL FK 제약 이름은 Supabase가 자동 생성한 이름을 따른다.
# IF EXISTS 를 붙여 이름이 다를 경우에도 안전하게 실행되도록 한다.
_DROP_STMTS = [
    "ALTER TABLE script_record  DROP CONSTRAINT IF EXISTS script_record_senior_id_fkey",
    "ALTER TABLE voice_feature  DROP CONSTRAINT IF EXISTS voice_feature_senior_id_fkey",
    "ALTER TABLE risk_prediction DROP CONSTRAINT IF EXISTS risk_prediction_senior_id_fkey",
]

_ADD_STMTS = [
    (
        "ALTER TABLE script_record ADD CONSTRAINT script_record_senior_id_fkey "
        "FOREIGN KEY (senior_id) REFERENCES senior(senior_id)"
    ),
    (
        "ALTER TABLE voice_feature ADD CONSTRAINT voice_feature_senior_id_fkey "
        "FOREIGN KEY (senior_id) REFERENCES senior(senior_id)"
    ),
    (
        "ALTER TABLE risk_prediction ADD CONSTRAINT risk_prediction_senior_id_fkey "
        "FOREIGN KEY (senior_id) REFERENCES senior(senior_id)"
    ),
]


def upgrade() -> None:
    for stmt in _DROP_STMTS:
        op.execute(stmt)


def downgrade() -> None:
    # 롤백: guardian actor 데이터가 남아 있으면 FK 복구가 실패할 수 있음.
    # 필요 시 해당 행을 먼저 정리한 뒤 downgrade 실행.
    for stmt in _ADD_STMTS:
        op.execute(stmt)
