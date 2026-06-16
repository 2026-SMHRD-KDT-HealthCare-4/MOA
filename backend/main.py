from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.routes import auth, chat, record, analyze

# DB 테이블 자동 생성
Base.metadata.create_all(bind=engine)

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
app.include_router(chat.router)
app.include_router(record.router)
app.include_router(analyze.router)

@app.get("/")
def root():
    return {"message": "MOA Backend is running!"}
