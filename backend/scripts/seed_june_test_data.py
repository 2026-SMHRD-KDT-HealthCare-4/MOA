"""
'이미자' 고령층(단일 테스트 계정)의 6월 한 달 치 VoiceFeature/RiskPrediction 테스트 데이터를
데이터베이스에 삽입한다. 이 스크립트는 오직 TARGET_EMAIL 계정 하나에만 영향을 준다.

피처 키는 실제 음성 분석(app.services.feature_extraction.extract_features)이 생성하는 키와
동일하게 맞춘다 — 특히 보호자 리포트 '이번 달 주목할 변화'가 읽는
speech_rate / pause_ratio / jitter_rap 를 반드시 포함한다. (과거 버전은 jitter/shimmer/vsa 등
다른 키를 써서 '주목할 변화'가 항상 비어 있었다.)

사용법:
  python scripts/seed_june_test_data.py          # 이 계정의 6월 데이터를 리셋 후 재삽입
  python scripts/seed_june_test_data.py --clean   # 이 계정의 6월 테스트 데이터를 삭제만 함

주의: 운영 DB가 아니라 개발/테스트 DB에서 실행할 것. 삭제·삽입 모두 이 계정 6월 범위에 한정된다.
"""

import argparse
import os
import sys
from datetime import datetime, timedelta
import random

# backend 루트를 import 경로에 추가 (어느 위치에서 실행해도 app.* 임포트되도록)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.models import Senior, VoiceFeature, RiskPrediction, Notification
from app.services.risk_prediction import predict_risk

TARGET_EMAIL = "senior-54bcbf2e-8813-4513-a941-934df95a5711@moa.app"

# 삭제·삽입 대상 기간(6월). 반열린 구간 [JUNE_START, JULY_START).
JUNE_START = datetime(2026, 6, 1)
JULY_START = datetime(2026, 7, 1)


def _delete_june(db, senior_id) -> tuple[int, int]:
    """해당 계정의 6월 VoiceFeature/RiskPrediction 행을 삭제하고 (vf, rp) 삭제 건수를 반환.

    notification.prediction_id 가 6월 risk_prediction 을 참조하고 있으면 FK 제약으로 삭제가
    막히므로, 그 참조 알림(RISK 알림)을 먼저 지운 뒤 예측을 삭제한다.
    """
    # 삭제 대상 6월 예측 id 목록 → 이를 참조하는 알림부터 제거
    june_pred_ids = [
        r.prediction_id
        for r in db.query(RiskPrediction.prediction_id)
        .filter(
            RiskPrediction.senior_id == senior_id,
            RiskPrediction.created_at >= JUNE_START,
            RiskPrediction.created_at < JULY_START,
        )
        .all()
    ]
    if june_pred_ids:
        db.query(Notification).filter(
            Notification.prediction_id.in_(june_pred_ids)
        ).delete(synchronize_session=False)

    vf_deleted = (
        db.query(VoiceFeature)
        .filter(
            VoiceFeature.senior_id == senior_id,
            VoiceFeature.measured_at >= JUNE_START,
            VoiceFeature.measured_at < JULY_START,
        )
        .delete(synchronize_session=False)
    )
    rp_deleted = (
        db.query(RiskPrediction)
        .filter(
            RiskPrediction.senior_id == senior_id,
            RiskPrediction.created_at >= JUNE_START,
            RiskPrediction.created_at < JULY_START,
        )
        .delete(synchronize_session=False)
    )
    return vf_deleted, rp_deleted


def _make_features(day: int) -> dict:
    """6월 day(1~30)의 가상 음향 피처. 실제 추출 키와 동일하게 구성한다.

    6월 초 → 말로 갈수록:
      - speech_rate 감소  → '발화 속도' 변화 감지
      - pause_ratio 증가  → '호흡 패턴' 변화 감지
      - jitter_rap 은 추세 없음 → '목소리 안정성' 안정
    (전반부 평균 대비 후반부 평균이 15% 임계값을 넘도록 진폭을 잡았다.)
    """
    progress = (day - 1) / 29  # 0.0(6/1) → 1.0(6/30)
    return {
        "f0_mean": round(random.uniform(140.0, 180.0), 2),
        "f0_std": round(random.uniform(10.0, 30.0), 2),
        "jitter_rap": round(random.uniform(0.010, 0.013), 4),
        "shimmer_local": round(random.uniform(0.02, 0.05), 4),
        "hnr": round(random.uniform(12.0, 22.0), 2),
        "nhr": round(random.uniform(0.03, 0.09), 4),
        "mpt": round(random.uniform(8.0, 18.0), 2),
        "spectral_centroid": round(random.uniform(1500.0, 2500.0), 1),
        "pause_ratio": round(0.18 + 0.20 * progress + random.uniform(-0.01, 0.01), 3),
        "speech_rate": round(3.6 - 1.4 * progress + random.uniform(-0.1, 0.1), 2),
        "vsa_area": round(random.uniform(0.8, 1.6), 2),
    }


def main(clean_only: bool = False) -> None:
    db = SessionLocal()
    try:
        senior = db.query(Senior).filter(Senior.email == TARGET_EMAIL).first()
        if not senior:
            print(f"Error: 이메일 {TARGET_EMAIL} 에 해당하는 고령층 사용자를 찾을 수 없습니다.")
            sys.exit(1)

        print(f"Found Senior: {senior.name} (ID: {senior.senior_id})")

        # 기존 6월 데이터는 항상 먼저 정리한다(피처 키를 새로 반영하기 위해 리셋 후 재삽입).
        vf_deleted, rp_deleted = _delete_june(db, senior.senior_id)
        print(f"기존 6월 데이터 삭제: VoiceFeature {vf_deleted}개, RiskPrediction {rp_deleted}개")

        if clean_only:
            db.commit()
            print("완료: 삭제만 수행(--clean).")
            return

        random.seed(42)  # 난수 고정(재현성)
        vf_count = 0
        rp_count = 0

        for day in range(1, 31):
            measured_time = datetime(2026, 6, day, 10, 0, 0)  # 오전 10시 측정
            features = _make_features(day)

            # 홀수날 SCRIPT / 짝수날 CHATBOT 으로 수집 유형 다양화
            collect_type = "SCRIPT" if day % 2 == 1 else "CHATBOT"
            db.add(
                VoiceFeature(
                    senior_id=senior.senior_id,
                    collect_type=collect_type,
                    voice_features=features,
                    measured_at=measured_time,
                    created_at=measured_time,
                )
            )
            vf_count += 1

            # predict_risk 는 features dict 전체를 시드로만 사용하므로 키 변경에 안전하다.
            predictions = predict_risk(features)
            db.add(
                RiskPrediction(
                    senior_id=senior.senior_id,
                    parkinson_score=predictions["parkinson"]["score"],
                    dementia_score=predictions["dementia"]["score"],
                    # 기존 DB 호환용 레거시 컬럼. 우울은 분석 대상에서 제외한다.
                    depression_score=0.0,
                    diabetes_score=predictions["diabetes"]["score"],
                    parkinson_level=predictions["parkinson"]["level"],
                    dementia_level=predictions["dementia"]["level"],
                    depression_level="GREEN",
                    diabetes_level=predictions["diabetes"]["level"],
                    created_at=measured_time + timedelta(minutes=5),  # 5분 후 예측 완료
                )
            )
            rp_count += 1

        db.commit()
        print("완료: 6월 1일 ~ 30일 테스트 데이터 재삽입 완료")
        print(f"  · 신규 삽입: VoiceFeature {vf_count}개, RiskPrediction {rp_count}개")

    except Exception as e:
        db.rollback()
        print(f"에러 발생: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="이미자 계정 6월 테스트 데이터 seeding/정리")
    parser.add_argument(
        "--clean",
        action="store_true",
        help="이 계정의 6월 테스트 데이터를 삭제만 하고 종료(재삽입하지 않음)",
    )
    args = parser.parse_args()
    main(clean_only=args.clean)
