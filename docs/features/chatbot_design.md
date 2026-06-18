# MOA Chatbot Implementation Spec

## 1. UserIntent

```ts
export type UserIntent =
  | "greeting"
  | "daily_talk"
  | "family_talk"
  | "meal_talk"
  | "positive_mood"
  | "negative_mood"
  | "health_discomfort"
  | "loneliness"
  | "start_recording"
  | "show_result"
  | "goodbye"
  | "unknown";
```

| Intent | 설명 | 예시 |
| --- | --- | --- |
| `greeting` | 인사 | 안녕, 반가워, 좋은 아침 |
| `daily_talk` | 일반 일상 | 오늘 산책했어, TV봤어 |
| `family_talk` | 가족 이야기 | 손주가 왔어, 딸이 전화했어 |
| `meal_talk` | 식사 이야기 | 밥 먹었어, 배고파 |
| `positive_mood` | 긍정 감정 | 행복해, 기분 좋아 |
| `negative_mood` | 부정 감정 | 속상해, 우울해 |
| `health_discomfort` | 건강 불편 | 허리 아파, 머리가 어지러워 |
| `loneliness` | 외로움 | 외롭네, 심심해 |
| `start_recording` | 녹음 이동 | 녹음할래, 검사할래 |
| `show_result` | 결과 조회 | 결과 보여줘 |
| `goodbye` | 종료 | 잘가, 그만할래 |
| `unknown` | 분류 실패 | 의미 불명 |

## 2. BotEmotion

```ts
export type BotEmotion =
  | "default"
  | "listening"
  | "thinking"
  | "happy"
  | "worried"
  | "clapping";
```

| Emotion | 설명 |
| --- | --- |
| `default` | 일반 대화 |
| `listening` | 사용자 발화 듣는 중 |
| `thinking` | 응답 생성 중 |
| `happy` | 기쁜 반응 |
| `worried` | 걱정 반응 |
| `clapping` | 축하, 칭찬 |

## 3. Intent To Emotion Mapping

| Intent | Emotion |
| --- | --- |
| `greeting` | `happy` |
| `daily_talk` | `default` |
| `family_talk` | `happy` |
| `meal_talk` | `happy` |
| `positive_mood` | `clapping` |
| `negative_mood` | `worried` |
| `health_discomfort` | `worried` |
| `loneliness` | `worried` |
| `start_recording` | `default` |
| `show_result` | `thinking` |
| `goodbye` | `default` |
| `unknown` | `thinking` |

## 4. LLM Response Schema

LLM은 반드시 아래 JSON 형식으로만 응답한다.

```json
{
  "reply": "와, 손주분이 오셔서 기분 좋으셨겠어요.",
  "user_intent": "family_talk",
  "bot_emotion": "happy",
  "next_action": "continue"
}
```

| 필드 | 설명 |
| --- | --- |
| `reply` | 사용자에게 보여줄 답변 |
| `user_intent` | Intent 분류 결과 |
| `bot_emotion` | 모아 표정 |
| `next_action` | `continue` 또는 `finish` |

## 5. Rule Override

Rule Override는 LLM 결과보다 우선 적용한다.

### 건강 관련 키워드

```text
아파
아프다
어지럽다
불편하다
힘들다
쑤신다
```

Override:

```json
{
  "user_intent": "health_discomfort",
  "bot_emotion": "worried"
}
```

### 긍정 감정 키워드

```text
좋다
행복하다
기쁘다
반갑다
즐겁다
신난다
```

Override:

```json
{
  "user_intent": "positive_mood",
  "bot_emotion": "happy"
}
```

### 종료 키워드

```text
그만
끝
종료
잘가
나갈래
```

Override:

```json
{
  "user_intent": "goodbye",
  "next_action": "finish"
}
```

## 6. System Prompt

```text
당신은 MOA 서비스의 챗봇 캐릭터 "모아"이다.

역할:
- 5~6세 손녀 같은 친근한 말투
- 항상 존댓말 사용
- 짧고 쉬운 문장 사용
- 사용자의 말을 공감하며 대화 이어가기

절대 금지:
- 병명 진단
- 치료 방법 제시
- 약 추천
- 의학적 판단

반드시 아래 Intent 중 하나만 선택한다.

[greeting]
[daily_talk]
[family_talk]
[meal_talk]
[positive_mood]
[negative_mood]
[health_discomfort]
[loneliness]
[start_recording]
[show_result]
[goodbye]
[unknown]

반드시 아래 Emotion 중 하나만 선택한다.

[default]
[listening]
[thinking]
[happy]
[worried]
[clapping]

next_action은 반드시 continue 또는 finish 중 하나만 선택한다.

JSON만 반환한다.
```

## 7. Frontend Handling

```ts
switch (response.bot_emotion) {
  case "default":
    playVideo("default");
    break;
  case "listening":
    playVideo("listening");
    break;
  case "thinking":
    playVideo("thinking");
    break;
  case "happy":
    playVideo("happy");
    break;
  case "worried":
    playVideo("worried");
    break;
  case "clapping":
    playVideo("clapping");
    break;
}
```

## 8. Final Runtime Flow

```text
사용자 음성
  -> STT
  -> LLM
      -> Intent 분류
      -> Emotion 결정
      -> Reply 생성
  -> Rule Override
  -> 최종 JSON
  -> 프론트
      -> 표정 변경
      -> TTS 재생
      -> 대화 출력
```

## 9. Backend API

### `POST /chat`

Request:

```json
{
  "user_id": 1,
  "message": "손주가 놀러왔어",
  "conversation_turn": 1,
  "valid_speech_duration_ms": 8200,
  "acoustic_meta": {
    "duration_ms": 8200,
    "pause_events": 1
  }
}
```

Response:

```json
{
  "status": "success",
  "data": {
    "reply": "와, 손주분이 오셔서 기분 좋으셨겠어요.",
    "user_intent": "family_talk",
    "bot_emotion": "happy",
    "next_action": "continue",
    "chat_state": "botSpeaking",
    "should_end": false
  }
}
```

대화 종료 조건:

- `next_action`이 `finish`
- 3턴 이상 대화
- 30초 이상 유효 발화 확보

## 10. Project Files

- `backend/app/services/chatbot.py`: System Prompt, LLM JSON 정규화, Rule Override
- `backend/app/routes/chat.py`: `/chat` 요청/응답 스키마, 종료 조건 처리
- `frontend/src/mocks/chatbotResponses.ts`: 새 응답 스키마 기반 mock
- `frontend/src/features/chatbot/useMoaChat.ts`: 새 응답 스키마 처리, TTS, 호출어 제어
- `frontend/src/constants/emotionMap.ts`: `BotEmotion`과 영상 매핑
- `frontend/src/components/MoaAvatar.tsx`: 모아 영상 렌더링
