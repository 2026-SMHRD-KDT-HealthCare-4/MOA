"""
음성 분석 라우터

- 프론트에서 음성 파일을 받아 특징 벡터를 추출해 VOICE_FEATURE 테이블에 저장한다.
- 음성 원본 + 사용자정보(age/bmi/gender)를 ML 통합 엔진에 넘겨 3개 질환 위험도를 추론하고
  RISK_PREDICTION 테이블에 저장한다. (app/services/ml_inference.py 가 ML팀 엔진을 호출)
  분석 대상은 파킨슨/치매/당뇨이며 우울은 제외한다.
- ZDR 원칙: 음성 원본은 메모리에서만 처리하고, 특징추출+추론 직후 즉시 폐기한다. 어떤 테이블에도
  WAV 원본은 저장하지 않는다. (요구사항 8번)

[CHATBOT/normal_chat 경로]
  매 턴마다 RiskPrediction 을 즉시 생성하는 대신 특징 벡터만 누적하고, 세션 종료(/chat/end)
  시점에 평균 특징으로 1건만 추론한다. (대화 세션 1개 = RiskPrediction 1건)
  - VoiceFeature 에 session_id 를 함께 저장해 /chat/end 에서 집계한다.
  - voice_features JSONB 에 기본 음향 특징과 함께 "_ml" 키로 ML 추론용 특징을 저장한다.
"""

from datetime import datetime
import traceback
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_senior
from app.models.models import ChatSession, RiskPrediction, Senior, VoiceFeature
from app.schemas.voice import AnalyzeResponseData
from app.services.feature_extraction import extract_features
from app.services.notification_service import create_risk_notifications_for_active_guardians
from app.services.ml_inference import extract_ml_features, predict_risk_from_wav
from app.services.risk_trigger import evaluate_risk_trigger
from app.services.weather_status import status_from_prediction

router = APIRouter(prefix="/analyze", tags=["analyze"])


def _log_analyze_error(error: Exception) -> None:
    print("[ANALYZE_ERROR]")
    print(f"Type: {type(error).__name__}")
    print(f"Repr: {repr(error)}")
    print("Traceback:")
    print(traceback.format_exc())


def _resolve_session_id(
    session_id_str: Optional[str],
    senior_id: UUID,
    db: Session,
) -> Optional[UUID]:
    """
    프론트가 session_id 를 보내면 그것을 우선 사용하고,
    없으면 해당 senior 의 현재 활성 ChatSession 을 자동 조회한다.
    활성 세션도 없으면 None 을 반환한다.
    """
    if session_id_str:
        try:
            return UUID(session_id_str)
        except ValueError:
            return None

    session = (
        db.query(ChatSession)
        .filter(
            ChatSession.senior_id == senior_id,
            ChatSession.ended_at.is_(None),
        )
        .order_by(ChatSession.started_at.desc())
        .first()
    )
    return session.session_id if session else None


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
    session_id: Optional[str] = Form(
        None,
        description="CHATBOT 세션 ID (프론트가 전달 시 사용, 없으면 서버가 활성 세션 자동 조회)",
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
        "gender": senior.gender,
        "age": age,
        "bmi": float(senior.bmi) if senior.bmi is not None else 0.0,
    }

    # ── CHATBOT/normal_chat 경로: 특징 저장만, 추론 스킵 ──────────────────────
    is_chatbot_normal = (collect_type == "CHATBOT" and sample_type == "normal_chat")

    if is_chatbot_normal:
        resolved_session_id = _resolve_session_id(session_id, senior_id, db)

        if resolved_session_id is None:
            # 활성 세션이 없으면 기존 방식으로 폴백
            print("[ANALYZE][CHATBOT_SKIP] 활성 세션 없음 — 기존 방식 폴백")
            is_chatbot_normal = False
        else:
            print(f"[ANALYZE][CHATBOT_NORMAL] session_id={resolved_session_id} — 추론 스킵, 특징만 저장")

    if is_chatbot_normal:
        try:
            # 2a. 기본 음향 특징 추출 (응답 및 VoiceFeature 저장용)
            print("[ANALYZE][CHATBOT_NORMAL] extract_features start")
            features = extract_features(audio_bytes)
            print("[ANALYZE][CHATBOT_NORMAL] extract_features success")

            # 2b. ML 추론용 특징 추출 (세션 종료 시 집계용 — 추론 없음)
            print("[ANALYZE][CHATBOT_NORMAL] extract_ml_features start")
            ml_features = extract_ml_features(audio_bytes, sample_type=sample_type)
            print("[ANALYZE][CHATBOT_NORMAL] extract_ml_features success")
        except Exception as e:
            _log_analyze_error(e)
            raise HTTPException(status_code=500, detail=f"음성 분석 실패: {str(e)}")
        finally:
            # ZDR: 메모리상의 음성 데이터 즉시 폐기
            del audio_bytes

        measured_at = datetime.utcnow()

        # 3a. VoiceFeature 저장 — 기본 음향 특징 + "_ml" 키에 ML 특징 병합
        stored_features = {**features, "_ml": ml_features}
        voice_feature = VoiceFeature(
            senior_id=senior_id,
            session_id=resolved_session_id,
            collect_type=collect_type,
            voice_features=stored_features,
            measured_at=measured_at,
        )
        db.add(voice_feature)

        try:
            print("[ANALYZE][CHATBOT_NORMAL] VoiceFeature save start")
            db.commit()
            db.refresh(voice_feature)
            print("[ANALYZE][CHATBOT_NORMAL] VoiceFeature save success")
        except Exception as e:
            db.rollback()
            _log_analyze_error(e)
            raise HTTPException(status_code=500, detail=f"음성분석결과 저장 실패: {str(e)}")

        print("[ANALYZE][CHATBOT_NORMAL] response build (risk_prediction=None)")
        return AnalyzeResponseData(
            feature_id=voice_feature.feature_id,
            features=features,
            risk_prediction=None,
            status=None,
            comparison=None,
            sample_type=sample_type,
            sample_status=sample_status,
        )

    # ── 그 외 경로 (SCRIPT / free_speech_intro / sustained_vowel / 폴백) ────────

    try:
        # 2. 특징 벡터 추출 (VOICE_FEATURE 저장용) — 내부 임시파일은 함수 종료 시 즉시 삭제됨
        print("[ANALYZE] extract_features start")
        features = extract_features(audio_bytes)
        print("[ANALYZE] extract_features success")
        # 3. ML 위험도 추론 (음성 원본 바이트 + 사용자정보 → 3개 질환 score/level)
        #    ML팀 통합 엔진(MOAInferenceEngine.predict_all)을 다리(ml_inference)를 통해 호출한다.
        print("[ANALYZE] predict_risk_from_wav start")
        risk_result = predict_risk_from_wav(audio_bytes, user_info, sample_type=sample_type)
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
        # 기존 DB/API 호환을 위한 레거시 컬럼. 우울은 분석·판정 대상에서 제외한다.
        depression_score=0.0,
        diabetes_score=risk_result["diabetes"]["score"],
        parkinson_level=risk_result["parkinson"]["level"],
        dementia_level=risk_result["dementia"]["level"],
        depression_level="GREEN",
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
