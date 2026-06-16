"""
음성 분석 라우터
- 프론트에서 음성 파일을 받아 특징점 추출 후 DB 저장
- ZDR 원칙: 음성 원본은 메모리에서만 처리, 디스크/DB에 저장하지 않음
"""

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.feature_extraction import extract_features
from app.models.models import VoiceRecord

router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("")
async def analyze_voice(
    user_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # 1. 음성 데이터를 메모리로만 읽음 (디스크 저장 X)
    audio_bytes = await file.read()

    try:
        # 2. 특징점 추출 (내부 임시파일은 함수 종료 시 즉시 삭제됨)
        features = extract_features(audio_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"특징점 추출 실패: {str(e)}")
    finally:
        # 3. ZDR: 메모리상의 음성 데이터 즉시 폐기
        del audio_bytes

    # 4. (예정) 질병 분류 모델 실행
    #    ML팀 모델 연동 후 아래에서 features를 입력으로 분류 수행
    #    result = classify_disease(features)
    score = None
    status = None

    # 5. 특징점만 DB에 저장 (음성 원본은 저장하지 않음)
    record = VoiceRecord(
        user_id=user_id,
        transcript=None,
        f0_mean=features.get("f0_mean"),
        f0_std=features.get("f0_std"),
        jitter_rap=features.get("jitter_rap"),
        shimmer_apq=features.get("shimmer_apq"),
        shimmer_local=features.get("shimmer_local"),
        shimmer_apq3=features.get("shimmer_apq3"),
        shimmer_apq11=features.get("shimmer_apq11"),
        hnr=features.get("hnr"),
        nhr=features.get("nhr"),
        mpt=features.get("mpt"),
        vsa_area=features.get("vsa_area"),
        pause_ratio=features.get("pause_ratio"),
        speech_rate=features.get("speech_rate"),
        alpha_ratio=features.get("alpha_ratio"),
        spectral_centroid=features.get("spectral_centroid"),
        score=score,
        status=status,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "status": "success",
        "data": {
            "id": record.id,
            "features": features,
            "score": score,
            "disease_status": status,
        }
    }
