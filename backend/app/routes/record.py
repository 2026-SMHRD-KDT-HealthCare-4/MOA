from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models.models import VoiceRecord, HealthStatus

router = APIRouter(prefix="/record", tags=["record"])

class RecordRequest(BaseModel):
    user_id: int
    transcript: str
    duration_ms: int = 0
    score: float = 70.0
    status: HealthStatus = HealthStatus.NORMAL

@router.post("")
def save_record(req: RecordRequest, db: Session = Depends(get_db)):
    record = VoiceRecord(
        user_id=req.user_id,
        transcript=req.transcript,
        score=req.score,
        status=req.status,
        duration_ms=req.duration_ms,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"status": "success", "data": {"id": record.id}}

@router.get("/report/{user_id}")
def get_report(user_id: int, db: Session = Depends(get_db)):
    records = (
        db.query(VoiceRecord)
        .filter(VoiceRecord.user_id == user_id)
        .order_by(VoiceRecord.created_at.desc())
        .limit(30)
        .all()
    )
    return {
        "status": "success",
        "data": [
            {
                "id": r.id,
                "transcript": r.transcript,
                "score": r.score,
                "status": r.status,
                "duration_ms": r.duration_ms,
                "created_at": r.created_at,
            }
            for r in records
        ]
    }
