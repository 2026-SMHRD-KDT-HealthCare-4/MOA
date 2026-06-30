"""Deterministic conversation guardrails used before and after the LLM."""

from __future__ import annotations

from typing import Any

INTENTS = {
    "meal_talk", "sleep_talk", "family_talk", "health_discomfort", "loneliness",
    "positive_mood", "negative_mood", "wake_up", "start_recording", "show_result",
    "navigate_record", "medication_info", "hospital_info", "family_connect",
    "goodbye", "unknown",
}
EMOTIONS = {"default", "listening", "thinking", "happy", "worried", "clapping"}
ACTIONS = {"continue", "finish", "navigate", "urgent_alert"}

QUESTION_SETS = {
    "meal": ["오늘 식사는 잘 하셨어요?", "가장 맛있게 드신 음식은 무엇이었어요?", "식사할 때 누구와 함께 계셨어요?"],
    "sleep": ["어젯밤에는 잠을 잘 주무셨어요?", "밤중에 깨신 일은 없으셨어요?", "오늘 아침에는 개운하게 일어나셨어요?"],
    "health": ["오늘 몸 상태는 어떠세요?", "특히 불편한 곳이 있으세요?", "조금 쉬면 나아지는 느낌이 드세요?"],
    "mood": ["오늘 기분은 어떠세요?", "기분이 좋아지거나 마음이 무거웠던 일이 있었어요?", "지금 가장 하고 싶은 일이 있으세요?"],
    "family": ["오늘 가족분과 이야기 나누셨어요?", "가족 생각이 나는 일이 있었어요?", "다음에 누구와 시간을 보내고 싶으세요?"],
}

TOPIC_BY_INTENT = {
    "meal_talk": "meal", "sleep_talk": "sleep", "health_discomfort": "health",
    "positive_mood": "mood", "negative_mood": "mood", "loneliness": "family", "family_talk": "family",
}

TOPIC_KEYWORDS = {
    "meal": ("밥", "식사", "먹었", "반찬", "간식"),
    "sleep": ("잠", "주무", "잠들", "깼", "밤"),
    "health": ("아파", "아프", "불편", "어지럽", "힘들", "허리", "머리"),
    "family": ("가족", "아들", "딸", "손주", "집에 가", "엄마", "아빠"),
    "mood": ("기분", "우울", "외롭", "슬프", "좋아", "행복"),
}


def _contains(text: str, phrases: tuple[str, ...]) -> bool:
    compact = text.replace(" ", "")
    return any(phrase.replace(" ", "") in compact for phrase in phrases)


def detect_rule(text: str) -> dict[str, Any] | None:
    """Rules that may never be overridden by LLM output."""
    if _contains(text, ("죽고 싶어", "살기 싫어", "사라지고 싶어", "그만 살고 싶어")):
        return response("지금 많이 힘드신 것 같아요. 혼자 계시지 말고 가까운 가족이나 119에 바로 도움을 요청해 주세요.", "negative_mood", "worried", "urgent_alert")
    if _contains(text, ("쓰러질 것 같아", "가슴이 답답해", "숨이 안 쉬어져", "심하게 어지러워")):
        return response("지금은 바로 주변에 도움을 요청해 주세요. 증상이 심하면 119에 연락하는 것이 좋아요.", "health_discomfort", "worried", "urgent_alert")
    if _contains(text, ("기록 페이지로 가자", "기록 보여줘", "기록 보러", "기록 페이지")):
        return response("네, 기록 화면으로 이동할게요.", "show_result", "happy", "navigate", "/history")
    if _contains(text, ("결과 보여줘", "결과 페이지", "검사 결과")):
        return response("네, 결과 화면으로 이동할게요.", "show_result", "happy", "navigate", "/report")
    if _contains(text, ("오늘 약 뭐야", "오늘 먹을 약 뭐야", "약 뭐 있어", "약 알림 보여줘", "복약 알림 보여줘")):
        return response("복약/병원 화면에서 오늘 예정된 내용을 확인해 볼게요.", "medication_info", "happy", "navigate", "/health")
    if _contains(text, ("병원 언제야", "병원 일정 알려줘", "병원 일정 보여줘")):
        return response("복약/병원 화면에서 병원 일정을 확인해 볼게요.", "hospital_info", "happy", "navigate", "/health")
    if _contains(text, ("녹음하러 가자", "검사하러 가자", "녹음하기", "목소리 검사하자", "음성 검사하자", "오늘 검사 시작", "다시 검사할래")):
        return response("좋아요. 목소리 검사 화면으로 이동할게요.", "navigate_record", "happy", "navigate", "/record")
    if _contains(text, ("가족 연결하고 싶어", "가족 연결", "보호자 연결", "가족 연동")):
        return response("가족 연결은 설정 화면에서 확인할 수 있어요.", "family_connect", "happy", "navigate", "/settings")
    if _contains(text, ("그만", "끝", "종료", "나갈래", "하기 싫어", "잘가", "잘 가", "바이바이", "빠이", "끊을게", "끊는다", "내일 봐", "내일 보자", "나중에 이야기", "다음에 만나")):
        return response("오늘 이야기 들려주셔서 고마워요. 필요하시면 언제든 다시 불러주세요.", "goodbye", "default", "finish")
    if _contains(text, ("아파", "아프다", "불편하다", "어지럽다", "힘들다")):
        return response("몸이 불편하셨군요. 무리하지 말고 편히 쉬어 주세요. 불편함이 계속되면 가족에게도 알려주세요.", "health_discomfort", "worried", "continue")
    return None


def response(reply: str, intent: str, emotion: str, action: str, route: str | None = None, topic: str | None = None, question_index: int = 0) -> dict[str, Any]:
    return {"reply": reply, "user_intent": intent, "bot_emotion": emotion, "next_action": action, "route": route, "conversation_topic": topic, "question_index": question_index}


def detect_topic(text: str) -> str | None:
    for topic, keywords in TOPIC_KEYWORDS.items():
        if _contains(text, keywords):
            return topic
    return None


def suggested_question(topic: str | None, question_index: int) -> str | None:
    if not topic or topic not in QUESTION_SETS:
        return None
    return QUESTION_SETS[topic][min(question_index, len(QUESTION_SETS[topic]) - 1)]


def validate_llm_response(raw: dict[str, Any], message: str, current_topic: str | None = None, question_index: int = 0) -> dict[str, Any]:
    """Validate every LLM response and apply deterministic final correction."""
    forced = detect_rule(message)
    if forced:
        return forced

    intent = str(raw.get("user_intent", "unknown"))
    if intent not in INTENTS:
        intent = "unknown"
    emotion = str(raw.get("bot_emotion", "default"))
    if emotion not in EMOTIONS:
        emotion = "default"
    action = str(raw.get("next_action", "continue"))
    if action not in ACTIONS:
        action = "continue"
    reply = str(raw.get("reply") or "말씀해 주셔서 고마워요. 조금 더 들려주세요.").strip()

    # GPT가 직접 리턴한 route를 살리고, 없을 시 intent 및 action 상황에 따라 자동 매핑
    route = raw.get("route")
    if not route and action == "navigate":
        if intent in ("navigate_record", "start_recording"):
            route = "/record"
        elif intent == "show_result":
            route = "/report"
        elif intent in ("medication_info", "hospital_info"):
            route = "/health"
        elif intent == "family_connect":
            route = "/settings"

    detected = detect_topic(message)
    topic = detected or TOPIC_BY_INTENT.get(intent) or current_topic
    next_index = question_index + 1 if topic == current_topic else 1
    # 7871ede 버전의 자연스러움을 유지하기 위해, GPT가 생성한 유연한 대답 뒤에 정적 질문 세트(QUESTION_SETS)를 기계적으로 이어붙이던 꼬리표 결합 코드를 스킵합니다.
    return response(reply, intent, emotion, action, route, topic, next_index)
