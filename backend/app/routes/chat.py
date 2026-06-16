from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.services.chatbot import chat_with_gpt
from app.models.models import ChatLog
from typing import Optional

router = APIRouter(prefix="/chat", tags=["chat"])

class AcousticMeta(BaseModel):
    duration_ms: int = 0
    pause_events: int = 0

class ChatRequest(BaseModel):
    user_id: int
    message: str
    acoustic_meta: Optional[AcousticMeta] = None

@router.post("")
def send_message(req: ChatRequest, db: Session = Depends(get_db)):
    # 이전 대화 내역 불러오기 (최근 10개)
    logs = (
        db.query(ChatLog)
        .filter(ChatLog.user_id == req.user_id)
        .order_by(ChatLog.created_at.desc())
        .limit(10)
        .all()
    )
    history = [{"role": log.role, "content": log.message} for log in reversed(logs)]

    try:
        result = chat_with_gpt(req.message, history)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GPT 오류: {str(e)}")

    # 유저 메시지 저장
    db.add(ChatLog(user_id=req.user_id, role="user", message=req.message))
    # 봇 응답 저장
    db.add(ChatLog(
        user_id=req.user_id,
        role="assistant",
        message=result["message"],
        emotion=result.get("emotion"),
    ))
    db.commit()

    return {
        "status": "success",
        "data": {
            "intent": "INT_001",
            "confidence": 0.9,
            "reply_type": "TEXT",
            "message": result["message"],
            "emotion_controls": {
                "user_emotion": "neutral",
                "bot_emotion": result.get("emotion", "happy"),
            },
            "payload": {
                "score": result.get("score", 70),
                "status": result.get("status", "NORMAL"),
            },
        }
    }

@router.get("/history/{user_id}")
def get_history(user_id: int, db: Session = Depends(get_db)):
    logs = (
        db.query(ChatLog)
        .filter(ChatLog.user_id == user_id)
        .order_by(ChatLog.created_at.asc())
        .all()
    )
    return {
        "status": "success",
        "data": [
            {"role": log.role, "message": log.message, "emotion": log.emotion, "created_at": log.created_at}
            for log in logs
        ]
    }
