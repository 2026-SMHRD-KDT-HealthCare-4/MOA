# Voice, Chat, Record Feature Spec

## 1. 범위

이 문서는 음성 녹음, STT, 챗봇, TTS, 호출어 기능을 다룬다.

## 2. 관련 파일

| 파일 | 역할 |
| --- | --- |
| `frontend/src/features/record/useRecorder.ts` | 녹음, 권한, STT, 임시 파일 삭제 |
| `frontend/src/features/chatbot/useMoaChat.ts` | 챗봇 메시지 상태, mock API, TTS |
| `frontend/src/mocks/chatbotResponses.ts` | mock 챗봇 응답 |
| `frontend/src/hooks/useWakeWord.ts` | 호출어 텍스트와 라우트 매핑 |
| `frontend/src/stores/wakeWordStore.ts` | 호출어 활성 상태 |

## 3. 녹음 플로우

1. 사용자가 녹음 버튼을 누른다.
2. 마이크 권한을 요청한다.
3. 권한이 있으면 호출어 감지를 비활성화한다.
4. `expo-av`로 녹음한다.
5. 사용자가 중지하면 처리 상태로 전환한다.
6. Whisper STT API를 호출하거나 mock transcript를 반환한다.
7. 임시 음성 파일을 삭제한다.
8. 결과 텍스트를 화면에 표시한다.
9. 호출어 감지를 다시 활성화한다.

## 4. 챗봇 플로우

1. 사용자가 텍스트를 입력한다.
2. 호출어 감지를 비활성화한다.
3. 사용자 메시지를 채팅 목록에 추가한다.
4. mock 챗봇 API를 호출한다.
5. bot emotion을 Moa 아바타 상태에 반영한다.
6. 응답 텍스트를 표시한다.
7. OpenAI TTS API 키가 있으면 음성을 재생한다.
8. 실패해도 텍스트 응답은 유지한다.
9. 호출어 감지를 다시 활성화한다.

## 5. 호출어 기능

현재 호출어 기능은 실제 상시 백그라운드 감지가 아니다. `useWakeWord`의 `handleSpeech(text)`에 텍스트가 들어왔을 때 라우팅하는 구조다.

예상 라우팅:

| 호출 문장 | 이동 경로 |
| --- | --- |
| "모아야 기록" | `/(elder)/history` |
| "모아야 홈" | `/(elder)/` |
| "모아야 설정" | `/(elder)/settings` |
| "모아야 대화하자" | `/chat` |

녹음 중 또는 대화 중에는 자동 비활성화해야 한다.

## 6. API 이전 방향

현재 OpenAI API 호출은 프론트 코드에 준비되어 있다. 실제 서비스에서는 다음처럼 변경한다.

- 프론트: 음성/텍스트 요청을 백엔드로 전송
- 백엔드: OpenAI API 호출, 결과 정제, 정책 필터링
- 프론트: 결과 표시와 재생만 담당

## 7. 변경 기록

- 2026-06-15: 음성/챗봇/호출어 기능 상세 문서 신설.
