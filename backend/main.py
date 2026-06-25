import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import auth, record, analyze, chat, medication, notification, report, speech
from app.services.scheduler import start_scheduler, shutdown_scheduler
from app.services.fcm_service import initialize_firebase

# 로깅 기본 설정 (앱 로그 출력용)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)

# DB 스키마는 Alembic 마이그레이션으로 관리한다.
# 테이블 생성/변경은 `alembic upgrade head` 로 적용하며, 여기서 create_all 을 호출하지 않는다.
# (create_all 은 기존 테이블 변경을 반영하지 못해 Alembic 과 충돌하므로 제거함)

app = FastAPI(title="MOA Backend API")

# CORS 설정 (프론트엔드 연동용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth.router)
app.include_router(record.router)
app.include_router(analyze.router)
app.include_router(chat.router)
app.include_router(medication.router)
app.include_router(notification.router)
app.include_router(report.router)
app.include_router(speech.router)

@app.on_event("startup")
def on_startup():
    initialize_firebase()
    start_scheduler()

@app.on_event("shutdown")
def on_shutdown():
    shutdown_scheduler()

@app.get("/")
def root():
    return {"message": "MOA Backend is running!"}
