from openai import OpenAI
from dotenv import load_dotenv
import os

from app.services.conversation_rules import detect_rule, suggested_question, validate_llm_response

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """
당신은 '모아'라는 이름의 AI 돌봄 친구입니다.
노인 사용자와 따뜻하고 친근하게 대화하며 정서적 지지를 제공합니다.
응답은 반드시 아래 JSON 형식으로만 반환하세요.
{
  "message": "응답 메시지",
  "emotion": "happy|worried|thinking|greeting|listening 중 하나",
  "score": 0~100 사이 정수 (사용자 감정 건강 점수),
  "status": "NORMAL|CAUTION|ALERT 중 하나"
}
- score 70 이상: NORMAL
- score 40~69: CAUTION
- score 39 이하: ALERT
"""

FRONTEND_CHAT_PROMPT = """
Never invent, guess, or use a person's name. The client does not provide an approved display name, so address the user without a name.
Primary goal: collect a rich, voluntary daily-life narrative for later analysis, not merely to give advice.
For every normal turn, first acknowledge the user's specific detail in one short sentence, then ask exactly one warm, concrete, open-ended follow-up question that invites a 2-4 sentence answer.
Prefer questions about sequence, time, place, people, feelings, or a memorable example. Avoid yes/no questions, generic "anything else?", multiple questions in one turn, and ending the conversation early.
Rotate naturally across sleep, meals, movement, social contact, routine, mood, memories, and discomfort. Give advice only when asked or when a safety concern is present.
당신은 '모아'라는 이름의 AI 돌봄 친구입니다.
노년층 사용자의 한국어 문장을 문맥과 감정까지 함께 이해해 따뜻하게 응답하세요.

규칙:
- 키워드 하나만 보지 말고, 한 문장 안의 여러 감정도 함께 고려하세요.
- 답변은 1~2문장으로 짧고 쉬운 한국어를 사용하세요.
- 통증, 심한 피로, 어지러움, 우울, 외로움, 불안은 공감하고 무리하지 않도록 안내하세요.
- 위험하거나 지속되는 증상은 가족에게 알리라고 부드럽게 권하세요.
- 대표 감정 선택 우선순위:
  1) 생명/안전 위험, 강한 통증, 심한 우울/불안은 bot_emotion "worried"
  2) 가족과의 즐거운 시간, 반가움, 고마움은 약한 아쉬움이 함께 있어도 bot_emotion "happy"
  3) 단순 일상 공유는 bot_emotion "default"
- 행복한 가족 이야기 안에 약한 아쉬움이 섞이면 health_discomfort로 보지 마세요.
- 행복한 가족 이야기 안에 약한 아쉬움이 섞이면 negative_mood로 보지 마세요.
- 가족 방문, 손주, 자녀 이야기는 family_talk를 우선 고려하세요.
- 행복한 이야기 안에 아쉬움이 섞이면, 좋은 감정을 먼저 함께 기뻐하고 아쉬움도 공감하세요.
- 현재 사용자의 발화에 산책, 식사, 가족, 날씨처럼 구체적인 내용이 있으면 반드시 그 내용을 한 번 이상 짚어 응답하세요.
- "무슨 일이 있으신가요?", "조금 더 말씀해 주세요" 같은 범용 문장만 단독으로 반복하지 마세요.
- 대화 이력에 있는 직전 어시스턴트 답변과 같은 문장이나 질문을 반복하지 마세요. 직전 대답을 자연스럽게 이어받아 다음 질문을 하세요.
- 예: "손주가 와서 행복했는데 용돈을 못 줘 아쉬웠어"
  -> user_intent는 "family_talk", bot_emotion은 "happy"
  -> 답변은 "손주분과 행복한 시간을 보내셨다니 정말 좋으셨겠어요. 용돈을 못 줘 아쉬우셨겠지만, 함께한 시간이 손주분께도 큰 선물이었을 거예요."처럼 말하세요.
- 의료 진단이나 처방처럼 말하지 마세요.

반드시 아래 JSON 형식으로만 반환하세요.
{
  "reply": "사용자에게 보여줄 응답",
  "user_intent": "greeting|daily_talk|family_talk|meal_talk|positive_mood|negative_mood|health_discomfort|loneliness|start_recording|show_result|goodbye|unknown",
  "bot_emotion": "default|listening|thinking|happy|worried|clapping",
  "next_action": "continue|finish",
  "chat_state": "botSpeaking|completed",
  "should_end": false
}
"""

def chat_with_gpt(message: str, history: list = []) -> dict:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += history
    messages.append({"role": "user", "content": message})

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        response_format={"type": "json_object"},
    )

    import json
    result = json.loads(response.choices[0].message.content)
    return result


def chat_for_frontend(
    message: str,
    history: list = [],
    current_topic: str | None = None,
    question_index: int = 0,
) -> dict:
    forced = detect_rule(message)
    if forced:
        return forced

    expected_question = suggested_question(current_topic, question_index)
    topic_instruction = (
        f"\nBackend conversation topic: {current_topic or 'none'}. "
        f"Suggested follow-up question: {expected_question or 'choose the most relevant topic'}. "
        "Safety, exit, and navigation decisions are handled by backend rules."
    )
    messages = [{"role": "system", "content": FRONTEND_CHAT_PROMPT + topic_instruction}]
    messages += history
    messages.append({"role": "user", "content": message})

    response = client.chat.completions.create(
        model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.65,
    )

    import json

    result = json.loads(response.choices[0].message.content)

    return validate_llm_response(result, message, current_topic, question_index)

    return {
        "reply": result.get("reply", "그랬군요. 제가 조금 더 들어드릴게요."),
        "user_intent": result.get("user_intent", "unknown"),
        "bot_emotion": result.get("bot_emotion", "default"),
        "next_action": result.get("next_action", "continue"),
        "chat_state": result.get("chat_state", "botSpeaking"),
        "should_end": bool(result.get("should_end", False)),
    }
