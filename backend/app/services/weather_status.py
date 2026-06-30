"""위험도 예측(RiskPrediction) → 앱의 비진단 '날씨' 메타포 변환 — 단일 소스.

기록 캘린더(/report/trend), 보호자 리포트, 녹음 직후 피드백(/analyze)이 모두 이 함수로만
날씨(sunny/cloudy/rainy)를 산출하도록 한 곳에 모은다. 한 화면이라도 따로 매핑하면 화면 간
날씨가 어긋나므로, 어디서든 반드시 이 함수만 사용한다.

규칙(요구사항 6, 비진단): 점수/병명 비노출. 4개 질환 level 중
- AMBER 가 하나라도 있으면 rainy(변화 감지)
- YELLOW 가 있으면 cloudy
- 그 외 sunny
"""

WEATHER_SUNNY = "sunny"
WEATHER_CLOUDY = "cloudy"
WEATHER_RAINY = "rainy"


def status_from_levels(
    parkinson_level: str,
    dementia_level: str,
    depression_level: str,
    diabetes_level: str,
) -> str:
    levels = {parkinson_level, dementia_level, depression_level, diabetes_level}
    if "AMBER" in levels:
        return WEATHER_RAINY
    if "YELLOW" in levels:
        return WEATHER_CLOUDY
    return WEATHER_SUNNY


def status_from_prediction(prediction) -> str:
    """RiskPrediction 레코드(ORM/스키마 무관, level 속성만 있으면 됨)를 날씨로 변환."""
    return status_from_levels(
        prediction.parkinson_level,
        prediction.dementia_level,
        prediction.depression_level,
        prediction.diabetes_level,
    )
