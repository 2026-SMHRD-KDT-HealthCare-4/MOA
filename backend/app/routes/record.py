from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.models.models import VoiceRecord, HealthStatus

router = APIRouter(prefix="/record", tags=["record"])

class RecordRequest(BaseModel):
    user_id: int
    transcript: Optional[str] = None

    # 음성 특징점
    f0_mean: Optional[float] = None
    f0_std: Optional[float] = None
    jitter_rap: Optional[float] = None
    shimmer_apq: Optional[float] = None
    shimmer_local: Optional[float] = None
    shimmer_apq3: Optional[float] = None
    shimmer_apq11: Optional[float] = None
    hnr: Optional[float] = None
    nhr: Optional[float] = None
    mpt: Optional[float] = None
    vsa_area: Optional[float] = None
    pause_ratio: Optional[float] = None
    speech_rate: Optional[float] = None
    alpha_ratio: Optional[float] = None
    spectral_centroid: Optional[float] = None

    score: Optional[float] = None
    status: Optional[HealthStatus] = None

@router.post("")
def save_record(req: RecordRequest, db: Session = Depends(get_db)):
    record = VoiceRecord(
        user_id=req.user_id,
        transcript=req.transcript,
        f0_mean=req.f0_mean,
        f0_std=req.f0_std,
        jitter_rap=req.jitter_rap,
        shimmer_apq=req.shimmer_apq,
        shimmer_local=req.shimmer_local,
        shimmer_apq3=req.shimmer_apq3,
        shimmer_apq11=req.shimmer_apq11,
        hnr=req.hnr,
        nhr=req.nhr,
        mpt=req.mpt,
        vsa_area=req.vsa_area,
        pause_ratio=req.pause_ratio,
        speech_rate=req.speech_rate,
        alpha_ratio=req.alpha_ratio,
        spectral_centroid=req.spectral_centroid,
        score=req.score,
        status=req.status,
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
                "f0_mean": r.f0_mean,
                "f0_std": r.f0_std,
                "jitter_rap": r.jitter_rap,
                "shimmer_apq": r.shimmer_apq,
                "shimmer_local": r.shimmer_local,
                "shimmer_apq3": r.shimmer_apq3,
                "shimmer_apq11": r.shimmer_apq11,
                "hnr": r.hnr,
                "nhr": r.nhr,
                "mpt": r.mpt,
                "vsa_area": r.vsa_area,
                "pause_ratio": r.pause_ratio,
                "speech_rate": r.speech_rate,
                "alpha_ratio": r.alpha_ratio,
                "spectral_centroid": r.spectral_centroid,
                "score": r.score,
                "status": r.status,
                "created_at": r.created_at,
            }
            for r in records
        ]
    }
