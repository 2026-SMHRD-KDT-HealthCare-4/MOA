from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool   # ← 추가
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,        # pgbouncer가 풀링하므로 SQLAlchemy 자체 풀은 끔
    pool_pre_ping=True,        # 죽은 연결 자동 감지
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()