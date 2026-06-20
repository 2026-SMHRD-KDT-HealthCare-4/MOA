# Backend and ML Guide

## 1. 현재 상태

`backend/`와 `ml/`은 아직 실제 구현이 없다. 두 폴더 모두 `.gitkeep`만 있는 상태다. 현재 STT/TTS/챗봇 관련 코드는 프론트에 준비되어 있으나, 실서비스 구조에서는 백엔드로 이동해야 한다.

## 2. 백엔드 목표

백엔드는 FastAPI 기반으로 다음 역할을 담당한다.

- 인증과 역할 관리
- 고령자 음성 기록 저장
- 보호자-고령자 연결 관리
- STT 요청 프록시
- TTS 요청 프록시
- 챗봇 응답 생성 또는 외부 모델 프록시
- 리포트 데이터 제공
- 개인정보/음성 파일 처리 정책 강제

### 현재 추가된 API 기반

- `GET /auth/me`: 인증된 사용자의 프로필과 본인 가족 연결 목록을 반환한다.
- `POST /speech/tts`: 인증된 사용자의 짧은 텍스트를 서버의 OpenAI 키로 MP3 음성으로 합성한다. 프론트에 API 키를 노출하지 않는다.
- `GET /report/trend/{senior_id}`: 보호자 또는 본인이 최근 변화 기록을 `sunny`/`cloudy`/`rainy` 메타포로 조회한다. 질환명·위험 점수는 응답에 포함하지 않는다.

## 3. 권장 API 그룹

| 그룹 | 예시 엔드포인트 | 설명 |
| --- | --- | --- |
| Auth | `POST /auth/login`, `POST /auth/register` | 로그인, 회원가입, 역할 반환 |
| Users | `GET /users/me` | 현재 사용자 정보 |
| Records | `POST /records`, `GET /records` | 음성 기록 생성/조회 |
| Chat | `POST /chat/messages` | 챗봇 응답 |
| Speech | `POST /speech/transcribe`, `POST /speech/tts` | STT/TTS 프록시 |
| Guardian | `GET /guardian/family`, `POST /guardian/invite` | 가족 연결 |
| Reports | `GET /reports/weekly` | 보호자 리포트 |

## 4. 데이터 모델 초안

### User

- `id`
- `role`: `elder` 또는 `guardian`
- `name`
- `email`
- `created_at`

### VoiceRecord

- `id`
- `elder_id`
- `recorded_at`
- `transcript`
- `acoustic_meta`
- `summary_status`: `sunny`, `cloudy`, `rainy`
- `created_at`

### ReportPoint

- `date`
- `status`
- `score_internal`
- `memo`

`score_internal`은 보호자 차트나 서버 분석에는 쓸 수 있지만, 고령자 화면에는 직접 노출하지 않는다.

## 5. ML 목표

ML은 음성의 변화 흐름을 참고 정보로 만드는 역할이다. MVP에서는 다음 스키마를 우선한다.

### 입력

- 음성 파일 또는 STT 텍스트
- 녹음 길이
- 발화 중 pause 이벤트
- 기록 시각
- 이전 기록과의 비교 기준

### 출력

- 상태 메타포: `sunny`, `cloudy`, `rainy`
- 보호자용 추이 점수 또는 내부 점수
- 챗봇/캐릭터 감정 제어 값
- 설명 문구 후보

## 6. 보안 원칙

- OpenAI API 키는 프론트에 두지 않는다.
- 음성 파일은 필요 최소 시간만 저장한다.
- 서버 로그에 원문 발화와 음성 파일 경로를 남기지 않는다.
- 분석 결과는 의료 진단처럼 표현하지 않는다.

## 7. 변경 기록

- 2026-06-20: 인증 사용자 조회, 서버 TTS 프록시, 안전한 날씨 메타포 기반 추이 조회 API를 추가.
- 2026-06-15: 백엔드/ML 미구현 상태와 목표 구조를 문서화.
