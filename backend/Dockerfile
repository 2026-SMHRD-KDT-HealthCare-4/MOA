FROM python:3.12-slim

# OS 시스템 패키지 설치 (librosa 등 오디오 연산 및 AI 라이브러리 가동을 위해 ffmpeg와 gcc 필수)
RUN apt-get update && apt-get install -y \
    build-essential \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 파이썬 의존성 및 로컬 패키지 복사
COPY backend/requirements.txt ./backend/requirements.txt
COPY ml/serab-byols ./ml/serab-byols

# 의존성 설치 (requirements.txt 내부의 로컬 패키지 상대 경로 포함)
RUN pip install --no-cache-dir -r backend/requirements.txt

# 전체 소스코드 복사
COPY backend ./backend
COPY ml ./ml

# 백엔드 실행 경로 설정
WORKDIR /app/backend

EXPOSE 8000

# 데이터베이스 마이그레이션(Alembic) 자동 수행 후 FastAPI 가동
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000"]
