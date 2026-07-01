"""
6월 한 달 동안 매일 하루씩 '이미자' 고령층의 VoiceFeature와 RiskPrediction 테스트 데이터를 데이터베이스에 삽입하는 스크립트.
기존 데이터가 존재하는 날짜는 건너뛰고, 없는 날짜에 대해서만 신규 삽입합니다.
"""

import os
import sys
from datetime import datetime, timedelta
import random
from sqlalchemy import func

# backend 루트를 import 경로에 추가 (어느 위치에서 실행해도 app.* 임포트되도록)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.models import Senior, VoiceFeature, RiskPrediction
from app.services.risk_prediction import predict_risk

TARGET_EMAIL = "senior-54bcbf2e-8813-4513-a941-934df95a5711@moa.app"

def main() -> None:
    db = SessionLocal()
    try:
        # 1. 대상 고령층 조회
        senior = db.query(Senior).filter(Senior.email == TARGET_EMAIL).first()
        if not senior:
            print(f"Error: 이메일 {TARGET_EMAIL} 에 해당하는 고령층 사용자를 찾을 수 없습니다.")
            sys.exit(1)
        
        print(f"Found Senior: {senior.name} (ID: {senior.senior_id})")
        
        # 2. 6월 1일부터 6월 30일까지 하루에 1개씩 삽입
        random.seed(42)  # 난수 고정
        
        vf_count = 0
        rp_count = 0
        skip_count = 0
        
        for day in range(1, 31):
            # 측정 시각 설정 (오전 10시 근처)
            measured_time = datetime(2026, 6, day, 10, 0, 0)
            target_date = measured_time.date()
            
            # 해당 날짜에 이미 데이터가 있는지 검사
            exists_vf = db.query(VoiceFeature).filter(
                VoiceFeature.senior_id == senior.senior_id,
                func.date(VoiceFeature.measured_at) == target_date
            ).first()
            
            exists_rp = db.query(RiskPrediction).filter(
                RiskPrediction.senior_id == senior.senior_id,
                func.date(RiskPrediction.created_at) == target_date
            ).first()
            
            if exists_vf and exists_rp:
                # 이미 둘 다 존재하면 건너뜀
                skip_count += 1
                continue
            
            # 음성 특징 벡터 가상 생성
            features = {
                "f0_mean": round(random.uniform(140.0, 180.0), 2),
                "jitter": round(random.uniform(0.005, 0.04), 4),
                "shimmer": round(random.uniform(0.01, 0.06), 4),
                "mpt": round(random.uniform(8.0, 18.0), 2),
                "hnr": round(random.uniform(12.0, 22.0), 2),
                "vsa": round(random.uniform(0.8, 1.6), 2)
            }
            
            # 1) VoiceFeature가 없는 경우 삽입
            if not exists_vf:
                # 홀수날/짝수날 수집 유형 다양화
                collect_type = "SCRIPT" if day % 2 == 1 else "CHATBOT"
                vf = VoiceFeature(
                    senior_id=senior.senior_id,
                    collect_type=collect_type,
                    voice_features=features,
                    measured_at=measured_time,
                    created_at=measured_time
                )
                db.add(vf)
                vf_count += 1
            
            # 2) RiskPrediction이 없는 경우 삽입
            if not exists_rp:
                # predict_risk 함수를 통해 예측된 점수 및 등급 획득 (비즈니스 규칙 부합)
                predictions = predict_risk(features)
                
                rp = RiskPrediction(
                    senior_id=senior.senior_id,
                    parkinson_score=predictions["parkinson"]["score"],
                    dementia_score=predictions["dementia"]["score"],
                    depression_score=predictions["depression"]["score"],
                    diabetes_score=predictions["diabetes"]["score"],
                    
                    parkinson_level=predictions["parkinson"]["level"],
                    dementia_level=predictions["dementia"]["level"],
                    depression_level=predictions["depression"]["level"],
                    diabetes_level=predictions["diabetes"]["level"],
                    
                    created_at=measured_time + timedelta(minutes=5)  # 5분 후 예측 완료 설정
                )
                db.add(rp)
                rp_count += 1
            
        db.commit()
        print(f"완료: 6월 1일 ~ 30일 테스트 데이터 처리 완료")
        print(f"  · 신규 삽입: VoiceFeature {vf_count}개, RiskPrediction {rp_count}개")
        print(f"  · 건너뜀 (이미 존재): {skip_count}개 날짜")
        
    except Exception as e:
        db.rollback()
        print(f"에러 발생: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
