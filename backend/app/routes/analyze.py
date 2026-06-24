"""
음성 분석 라우터

- 프론트에서 음성 파일을 받아 특징 벡터 추출 후 VOICE_FEATURE 테이블에 저장한다.
- 추출된 특징 벡터를 입력으로 (더미) 질환 위험도를 추론해 RISK_PREDICTION 테이블에 함께 저장한다.
  ML팀 모델이 준비되면 app/services/risk_prediction.py 의 predict_risk() 만 교체하면 된다.
- ZDR 원칙: 음성 원본은 메모리에서만 처리하고, 처리 직후 즉시 폐기한다. 어떤 테이블에도
  WAV 원본은 저장하지 않는다. (요구사항 8번)
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from uuid import UUID

from app.core.security import get_current_user_id
from app.models.models import RiskPrediction, VoiceFeature
from app.schemas.voice import AnalyzeResponseData
from app.services.feature_extraction import extract_features
from app.services.notification_service import create_risk_notifications_for_active_guardians
from app.services.risk_prediction import predict_risk
from app.services.risk_trigger import evaluate_risk_trigger

router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("", response_model=AnalyzeResponseData)
async def analyze_voice(
    collect_type: str = Form(..., description="SCRIPT 또는 CHATBOT"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """로그인한 사용자(고령층·보호자 공통) 음성 분석. senior_id 컬럼에 user_id 저장."""
    if collect_type not in ("SCRIPT", "CHATBOT"):
        raise HTTPException(status_code=400, detail="collect_type은 SCRIPT 또는 CHATBOT 이어야 합니다.")

    senior_id = user_id  # guardian·senior 공통 actor ID

    # 1. 음성 데이터를 메모리로만 읽음 (디스크 저장 X)
    audio_bytes = await file.read()

    try:
        # 2. 특징 벡터 추출 (내부 임시파일은 함수 종료 시 즉시 삭제됨)
        features = extract_features(audio_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"특징 벡터 추출 실패: {str(e)}")
    finally:
        # 3. ZDR: 메모리상의 음성 데이터 즉시 폐기
        del audio_bytes

    measured_at = datetime.utcnow()

    # 4. 음성분석결과(VOICE_FEATURE) 저장 — 수치 벡터만 JSONB로 적재, 원본 음성은 저장하지 않음
    voice_feature = VoiceFeature(
        senior_id=senior_id,
        collect_type=collect_type,
        voice_features=features,
        measured_at=measured_at,
    )
    db.add(voice_feature)

    try:
        db.commit()
        db.refresh(voice_feature)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"음성분석결과 저장 실패: {str(e)}")

    # 5. 질환별 위험도 추론 (현재는 더미 구현 — ML팀 모델 연동 전)
    risk_result = predict_risk(features)

    risk_prediction = RiskPrediction(
        senior_id=senior_id,
        parkinson_score=risk_result["parkinson"]["score"],
        dementia_score=risk_result["dementia"]["score"],
        depression_score=risk_result["depression"]["score"],
        diabetes_score=risk_result["diabetes"]["score"],
        parkinson_level=risk_result["parkinson"]["level"],
        dementia_level=risk_result["dementia"]["level"],
        depression_level=risk_result["depression"]["level"],
        diabetes_level=risk_result["diabetes"]["level"],
    )
    db.add(risk_prediction)

    try:
        db.commit()
        db.refresh(risk_prediction)
    except Exception as e:
        db.rollback()
        # 음성분석결과는 이미 저장되었으므로 위험도 예측 실패는 별도로 알리되 분석 자체는 성공 처리
        raise HTTPException(status_code=500, detail=f"위험도 예측 결과 저장 실패: {str(e)}")

    # 6. 자동 알림 트리거 평가 (AMBER 즉시 / YELLOW 누적)
    #    트리거 판정/알림 생성 실패가 분석 결과 자체를 깨뜨리지 않도록 예외를 격리한다.
    try:
        trigger = evaluate_risk_trigger(db, senior_id, risk_prediction)
        if trigger["should_notify"]:
            create_risk_notifications_for_active_guardians(
                db, senior_id, risk_prediction.prediction_id
            )
    except Exception:
        # 알림 생성 실패는 분석 응답에 영향을 주지 않는다 (로깅 후 무시).
        db.rollback()

    return AnalyzeResponseData(
        feature_id=voice_feature.feature_id,
        features=features,
        risk_prediction=risk_prediction,
    )
