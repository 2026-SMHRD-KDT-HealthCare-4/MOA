from openai import OpenAI
from dotenv import load_dotenv
import os

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
