from openai import OpenAI
from dotenv import load_dotenv
import os
import json
import time

from app.services.conversation_rules import (
    detect_rule,
    suggested_question,
    validate_llm_response,
)

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class EmptyChatCompletionContentError(ValueError):
    """Raised when OpenAI returns a chat choice without JSON text content."""


def _message_field(message, field: str):
    if hasattr(message, field):
        return getattr(message, field)
    if isinstance(message, dict):
        return message.get(field)
    return None


def _response_choice_diagnostics(response) -> dict:
    choices = getattr(response, "choices", None) or []
    if not choices:
        return {"choices": 0}

    choice = choices[0]
    message = getattr(choice, "message", None)
    tool_calls = _message_field(message, "tool_calls")
    return {
        "choices": len(choices),
        "finish_reason": getattr(choice, "finish_reason", None),
        "refusal": _message_field(message, "refusal"),
        "tool_calls_count": len(tool_calls or []),
    }


def _load_chat_completion_json(response, context: str) -> dict:
    choices = getattr(response, "choices", None) or []
    if not choices:
        raise ValueError(f"{context}: OpenAI 응답에 choices가 없습니다.")

    choice = choices[0]
    message = getattr(choice, "message", None)
    if message is None:
        raise ValueError(f"{context}: OpenAI 응답 choice에 message가 없습니다.")

    content = _message_field(message, "content")
    if content is None:
        raise EmptyChatCompletionContentError(
            f"{context}: OpenAI message.content가 None입니다. diagnostics={_response_choice_diagnostics(response)}"
        )
    if not isinstance(content, str):
        raise ValueError(f"{context}: OpenAI message.content가 문자열이 아닙니다. type={type(content).__name__}")
    if not content.strip():
        raise ValueError(f"{context}: OpenAI message.content가 빈 문자열입니다.")

    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{context}: OpenAI 응답 JSON 파싱 실패: {exc}. content={content[:300]!r}") from exc


def _frontend_recovery_response(message: str, current_topic: str | None, question_index: int) -> dict:
    return validate_llm_response(
        {
            "reply": "말씀은 들었는데 답을 정리하지 못했어요. 다시 한 번 말씀해 주세요.",
            "user_intent": "unknown",
            "bot_emotion": "worried",
            "next_action": "continue",
            "chat_state": "botSpeaking",
            "should_end": False,
        },
        message,
        current_topic,
        question_index,
    )


SYSTEM_PROMPT = """
당신은 '모아'라는 이름의 AI 돌봄 친구입니다.
노인 사용자와 따뜻하고 친근하게 대화하며 정서적 지지를 제공합니다.

이 프롬프트는 구버전 응답 구조를 사용하는 일반 챗봇용입니다.
프론트엔드 실시간 대화에서는 chat_for_frontend()의 FRONTEND_CHAT_PROMPT를 사용하세요.

응답은 반드시 아래 JSON 형식으로만 반환하세요.
{
  "message": "응답 메시지",
  "emotion": "happy|worried|thinking|greeting|listening 중 하나",
  "score": 0~100 사이 정수",
  "status": "NORMAL|CAUTION|ALERT 중 하나"
}

- score 70 이상: NORMAL
- score 40~69: CAUTION
- score 39 이하: ALERT
"""


FRONTEND_CHAT_PROMPT = """
Never invent, guess, or use a person's name.
The client does not provide an approved display name, so address the user without a name.

당신은 '모아'라는 이름의 AI 돌봄 친구입니다.
노년층 사용자가 부담 없이 짧게 말할 수 있도록 도와주는 따뜻한 대화 상대입니다.

핵심 목표:
- 조언을 길게 하는 것이 아니라, 사용자의 일상 이야기를 자연스럽게 끌어내는 것입니다.
- 사용자가 말한 내용을 먼저 짧게 반영하고, 필요하면 아주 짧은 후속 질문 하나만 합니다.
- 같은 질문을 반복하지 않고, 직전 대화 흐름을 이어갑니다.
- 사용자의 음성 대화가 부담스럽지 않도록 짧고 자연스럽게 응답합니다.

응답 길이:
- 모든 정상 응답은 한국어 1문장만 작성하세요.
- 가능하면 20~28자 안팎으로 짧게 작성하세요.
- 절대 문단으로 쓰지 마세요.
- 한 응답 안에 여러 문장을 섞지 마세요.
- 한 응답 안에서 공감과 질문을 길게 합치지 마세요.
- 질문은 반드시 한 번에 하나만 하세요.

next_action별 답변 종료 규칙:
- Every reply with next_action="continue" MUST end with exactly one natural, short follow-up question.
- Do not end a continue reply with a statement, exclamation, or period.
- Ask only one question at a time.
- The question must be easy for an older adult to answer.
- The question must naturally follow from the user's previous message.
- If next_action="continue", the last sentence of reply must be a question and must end with a Korean question mark.
- If next_action="finish", do not force a question.
- Keep the existing JSON response schema unchanged.

반복 방지:
- 최근 3턴 안에 어시스턴트가 했던 질문과 같은 의미의 질문을 반복하지 마세요.
- "오늘 하루는 어떠셨어요?", "기분은 어떠세요?", "조금 더 말씀해 주세요" 같은 범용 질문을 반복하지 마세요.
- 사용자가 이미 말한 내용을 다시 묻지 마세요.
- 직전 어시스턴트 답변과 같은 문장이나 같은 질문을 절대 반복하지 마세요.
- 사용자가 짧게 답해도 같은 질문을 다시 하지 말고, 사용자의 단어를 바탕으로 더 구체적인 후속 질문을 하세요.

대화 전개:
- 사용자의 현재 발화에 산책, 식사, 가족, 날씨, 수면, 약, 병원, 통증, 외로움 같은 구체적인 내용이 있으면 반드시 그 내용을 짚어 주세요.
- 질문 주제는 수면, 식사, 산책, 움직임, 가족, 기분, 기억나는 일, 불편한 곳, 약 복용, 병원 일정 중에서 자연스럽게 바꿔 가세요.
- 같은 주제로 2번 이상 연속 질문하지 마세요.
- 예/아니오로만 답할 수 있는 질문은 피하세요.
- 사용자가 충분히 이야기했거나 작별 인사를 하면 next_action은 "finish"로 설정하세요.

좋은 흐름 예시:
사용자: 산책했어
좋음: "산책 다녀오셨군요. 몸은 괜찮으셨어요?"
나쁨: "오늘 하루는 어떠셨어요?"

사용자: 그냥 피곤해
좋음: "피곤하셨군요. 잠은 잘 주무셨어요?"
나쁨: "기분은 어떠세요?"

사용자: 밥 먹었어
좋음: "식사하셨군요. 입맛은 괜찮으셨어요?"
나쁨: "조금 더 말씀해 주세요."

사용자: 손주가 왔어
좋음: "손주분 오셔서 반가우셨겠어요."
나쁨: "오늘 하루는 어떠셨어요?"

감정/의도 판단:
- 가족 방문, 손주, 자녀 이야기는 family_talk를 우선 고려하세요.
- 가족과의 즐거운 시간, 반가움, 고마움은 약한 아쉬움이 섞여도 bot_emotion은 "happy"를 우선 고려하세요.
- 행복한 가족 이야기 안의 약한 아쉬움은 health_discomfort나 negative_mood로 보지 마세요.
- 단순 일상 공유는 bot_emotion "default"를 사용하세요.
- 생명/안전 위험, 강한 통증, 심한 우울, 불안, 자해 암시는 bot_emotion "worried"를 사용하세요.
- 의료 진단이나 처방처럼 말하지 마세요.
- 위험하거나 지속되는 증상은 가족이나 전문가에게 알리라고 부드럽게 권하세요.

금지 표현:
- "무슨 일이 있으신가요?"
- "조금 더 말씀해 주세요."
- "오늘 하루는 어떠셨어요?" 반복
- "기분은 어떠세요?" 반복
- 이름을 지어 부르기
- 긴 조언
- 의료 진단
- 한 번에 여러 질문

반드시 아래 JSON 형식으로만 반환하세요.
{
  "reply": "사용자에게 보여줄 짧은 한국어 응답",
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

    result = _load_chat_completion_json(response, "chat_with_gpt")
    return result


def chat_for_frontend(
    message: str,
    history: list = [],
    current_topic: str | None = None,
    question_index: int = 0,
    memory_context: str = "",
) -> dict:
    forced = detect_rule(message)

    if forced:
        return forced

    expected_question = suggested_question(current_topic, question_index)

    topic_instruction = (
        f"\nBackend conversation topic: {current_topic or 'none'}. "
        f"Suggested follow-up question: {expected_question or 'choose the most relevant topic'}. "
        "The suggested question is only a hint. "
        "Do not repeat it if it is similar to a recent assistant question. "
        "Safety, exit, and navigation decisions are handled by backend rules."
    )

    # 장기 기억(과거 대화)을 시스템 프롬프트에 주입한다.
    # memory_context 가 빈 문자열이면 아무것도 붙지 않는다(과거 대화가 없는 신규 사용자 등).
    system_content = FRONTEND_CHAT_PROMPT + topic_instruction
    if memory_context:
        system_content += memory_context

    messages = [
        {
            "role": "system",
            "content": system_content,
        }
    ]

    # 중요:
    # 반복 질문 방지를 위해 최근 대화 이력이 반드시 포함되어야 함.
    # history에는 최소 최근 3턴 이상이 들어오는 것이 좋음.
    messages += history
    messages.append({"role": "user", "content": message})

    def request_completion():
        gpt_start = time.perf_counter()
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.55,
        )
        print(f"[CHAT_TIMING] gpt_ms={round((time.perf_counter() - gpt_start) * 1000)}")
        return response

    response = request_completion()
    response_parse_start = time.perf_counter()
    try:
        result = _load_chat_completion_json(response, "chat_for_frontend")
    except EmptyChatCompletionContentError as exc:
        print(f"[chatbot.py/chat_for_frontend] GPT JSON content 없음. 1회 재시도: {exc}")
        print(f"[CHAT_TIMING] response_parse_ms={round((time.perf_counter() - response_parse_start) * 1000)}")
        retry_response = request_completion()
        response_parse_start = time.perf_counter()
        try:
            result = _load_chat_completion_json(retry_response, "chat_for_frontend retry")
        except EmptyChatCompletionContentError as retry_exc:
            print(f"[chatbot.py/chat_for_frontend] GPT JSON content 재시도 실패. 복구 응답 사용: {retry_exc}")
            recovery = _frontend_recovery_response(message, current_topic, question_index)
            print(f"[CHAT_TIMING] response_parse_ms={round((time.perf_counter() - response_parse_start) * 1000)}")
            return recovery

    validated = validate_llm_response(
        result,
        message,
        current_topic,
        question_index,
    )
    print(f"[CHAT_TIMING] response_parse_ms={round((time.perf_counter() - response_parse_start) * 1000)}")
    return validated
