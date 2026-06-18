"""
Alembic 마이그레이션 환경 설정.

- DATABASE_URL 은 alembic.ini에 하드코딩하지 않고 .env 에서 읽는다 (운영/개발 DB 분리, 비밀정보 보호).
- target_metadata 에 우리 모델의 Base.metadata 를 연결해 autogenerate 가 모델 변경을 감지하게 한다.
"""

import os
import sys
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

# 프로젝트 루트를 import 경로에 추가 (app 패키지 인식용)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

# 모든 모델을 import 해야 Base.metadata 에 테이블이 등록된다.
from app.core.database import Base  # noqa: E402
from app.models import models  # noqa: E402,F401  (테이블 등록 목적의 import)

config = context.config

# .env 의 DATABASE_URL 을 Alembic 설정에 주입
database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """오프라인 모드: DB 연결 없이 SQL 스크립트만 생성."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,         # 컬럼 타입 변경도 감지
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """온라인 모드: 실제 DB에 연결해 마이그레이션 적용."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
