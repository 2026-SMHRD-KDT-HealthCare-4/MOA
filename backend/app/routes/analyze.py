"""
음성 분석 라우터

- 프론트에서 음성 파일을 받아 특징 벡터를 추출해 VOICE_FEATURE 테이블에 저장한다.
- 음성 원본 + 사용자정보(age/bmi/gender)를 ML 통합 엔진에 넘겨 4개 질환 위험도를 추론하고
  RISK_PREDICTION 테이블에 저장한다. (app/services/ml_inference.py 가 ML팀 엔진을 호출)
  현재는 파킨슨만 실제 추론되고, 치매/당뇨는 입력(과제 분할/BYOL-S 임베딩) 준비 후 확장한다.
- ZDR 원칙: 음성 원본은 메모리에서만 처리하고, 특징추출+추론 직후 즉시 폐기한다. 어떤 테이블에도
  WAV 원본은 저장하지 않는다. (요구사항 8번)
"""

from datetime import datetime
import traceback
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_senior
from app.models.models import RiskPrediction, Senior, VoiceFeature
from app.schemas.voice import AnalyzeResponseData
from app.services.feature_extraction import extract_features
from app.services.notification_service import create_risk_notifications_for_active_guardians
from app.services.ml_inference import predict_risk_from_wav
from app.services.risk_trigger import evaluate_risk_trigger
from app.services.weather_status import status_from_prediction

router = APIRouter(prefix="/analyze", tags=["analyze"])


def _log_analyze_error(error: Exception) -> None:
    print("[ANALYZE_ERROR]")
    print(f"Type: {type(error).__name__}")
    print(f"Repr: {repr(error)}")
    print("Traceback:")
    print(traceback.format_exc())


@router.post("", response_model=AnalyzeResponseData)
async def analyze_voice(
    collect_type: str = Form(..., description="SCRIPT 또는 CHATBOT"),
    sample_type: Optional[Literal["free_speech_intro", "sustained_vowel", "normal_chat"]] = Form(
        None,
        description="free_speech_intro, sustained_vowel, normal_chat",
    ),
    sample_status: Optional[Literal["ok", "too_short", "failed"]] = Form(
        None,
        description="ok, too_short, failed",
    ),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    senior: Senior = Depends(get_current_senior),
):
    print("[ANALYZE] request received")
    if collect_type not in ("SCRIPT", "CHATBOT"):
        raise HTTPException(status_code=400, detail="collect_type은 SCRIPT 또는 CHATBOT 이어야 합니다.")

    senior_id = senior.senior_id

    # 1. 음성 데이터를 메모리로만 읽음 (디스크 저장 X)
    print("[ANALYZE] file.read start")
    audio_bytes = await file.read()
    print("[ANALYZE] file.read success")

    # 당뇨 모델 입력용 사용자 정보 구성 (senior 테이블에서) — 토큰 기반이라 신뢰 가능
    if senior.birth_date is not None:
        age = int((datetime.utcnow() - senior.birth_date).days // 365)
    else:
        age = 0
    user_info = {
        "gender": senior.gender,                       # 'M' | 'F'
        "age": age,
        "bmi": float(senior.bmi) if senior.bmi is not None else 0.0,
    }

    try:
        # 2. 특징 벡터 추출 (VOICE_FEATURE 저장용) — 내부 임시파일은 함수 종료 시 즉시 삭제됨
        print("[ANALYZE] extract_features start")
        features = extract_features(audio_bytes)
        print("[ANALYZE] extract_features success")
        # 3. ML 위험도 추론 (음성 원본 바이트 + 사용자정보 → 4개 질환 score/level)
        #    ML팀 통합 엔진(MOAInferenceEngine.predict_all)을 다리(ml_inference)를 통해 호출한다.
        print("[ANALYZE] predict_risk_from_wav start")
        risk_result = predict_risk_from_wav(audio_bytes, user_info)
        print("[ANALYZE] predict_risk_from_wav success")
    except Exception as e:
        _log_analyze_error(e)
        raise HTTPException(status_code=500, detail=f"음성 분석 실패: {str(e)}")
    finally:
        # 4. ZDR: 메모리상의 음성 데이터 즉시 폐기
        del audio_bytes

    measured_at = datetime.utcnow()

    # 5. 음성분석결과(VOICE_FEATURE) 저장 — 수치 벡터만 JSONB로 적재, 원본 음성은 저장하지 않음
    voice_feature = VoiceFeature(
        senior_id=senior_id,
        collect_type=collect_type,
        voice_features=features,
        measured_at=measured_at,
    )
    db.add(voice_feature)

    try:
        print("[ANALYZE] VoiceFeature save start")
        db.commit()
        db.refresh(voice_feature)
        print("[ANALYZE] VoiceFeature save success")
    except Exception as e:
        db.rollback()
        _log_analyze_error(e)
        raise HTTPException(status_code=500, detail=f"음성분석결과 저장 실패: {str(e)}")

    # 6. 위험도 예측 결과(RISK_PREDICTION) 저장 (위 3에서 ML 추론 완료)
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
        print("[ANALYZE] RiskPrediction save start")
        db.commit()
        db.refresh(risk_prediction)
        print("[ANALYZE] RiskPrediction save success")
    except Exception as e:
        db.rollback()
        _log_analyze_error(e)
        # 음성분석결과는 이미 저장되었으므로 위험도 예측 실패는 별도로 알리되 분석 자체는 성공 처리
        raise HTTPException(status_code=500, detail=f"위험도 예측 결과 저장 실패: {str(e)}")

    # 7. 자동 알림 트리거 평가 (AMBER 즉시 / YELLOW 누적)
    #    트리거 판정/알림 생성 실패가 분석 결과 자체를 깨뜨리지 않도록 예외를 격리한다.
    try:
        trigger = evaluate_risk_trigger(db, senior_id, risk_prediction)
        if trigger["should_notify"]:
            create_risk_notifications_for_active_guardians(
                db, senior_id, risk_prediction.prediction_id
            )
    except Exception as e:
        _log_analyze_error(e)
        # 알림 생성 실패는 분석 응답에 영향을 주지 않는다 (로깅 후 무시).
        db.rollback()

    # 8. 녹음 직후 피드백용 날씨 + 직전 기록 비교 (캘린더/리포트와 동일한 단일 소스 사용)
    status = status_from_prediction(risk_prediction)
    prev = (
        db.query(RiskPrediction)
        .filter(
            RiskPrediction.senior_id == senior_id,
            RiskPrediction.prediction_id != risk_prediction.prediction_id,
        )
        .order_by(RiskPrediction.created_at.desc())
        .first()
    )
    if prev is None:
        comparison = "first"
    else:
        comparison = "similar" if status_from_prediction(prev) == status else "changed"

    print("[ANALYZE] response build")
    return AnalyzeResponseData(
        feature_id=voice_feature.feature_id,
        features=features,
        risk_prediction=risk_prediction,
        status=status,
        comparison=comparison,
        sample_type=sample_type,
        sample_status=sample_status,
    )
