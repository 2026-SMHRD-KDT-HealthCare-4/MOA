"""Speech API routes.

The mobile client never needs to hold an OpenAI API key: authenticated users ask
this route to synthesize short Moa responses and receive an MP3 stream.
"""

import base64
import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel, Field

from app.core.security import get_current_user_id

router = APIRouter(prefix="/speech", tags=["speech"])

MAX_TTS_TEXT_LENGTH = 500
MAX_AUDIO_BYTES = 25 * 1024 * 1024
TYPECAST_TTS_URL = "https://api.typecast.ai/v1/text-to-speech"
TYPECAST_VOICE_ID = os.getenv("TYPECAST_VOICE_ID", "tc_65c47f4f7e237f1cb0a80380")
TYPECAST_MODEL = os.getenv("TYPECAST_TTS_MODEL", "ssfm-v30")

# --- STT 환각/무음 필터 설정 ---
# Whisper가 무음·잡음 구간에서 학습 데이터의 방송/자막 문구("시청해주셔서 감사합니다" 등)를
# 실제 발화처럼 만들어내는 현상을 차단한다. 프론트(useRecorder.ts)의 2겹 방어와 동일한 정책을
# 백엔드 /speech/transcribe 경로에도 적용하기 위한 것이다.
# 임계값은 시작값이며, 실제 사용 환경(노인 음성·기기 마이크)에 맞춰 튜닝이 필요하다.
NO_SPEECH_PROB_THRESHOLD = 0.6
AVG_LOGPROB_THRESHOLD = -0.8

# 방송사명 · 뉴스/앵커 클로징 · 시청/구독 유도 · 자막 제작 표기 등 환각 단골 문구.
# 프론트(useRecorder.ts)의 HALLUCINATION_PATTERNS 와 1:1로 동일하게 유지한다.
# (한쪽만 고치면 두 경로의 동작이 어긋나므로, 패턴 변경 시 양쪽을 함께 수정할 것.)
# 주의: "감사합니다" 단독은 진짜 감사 인사와 충돌(오탐)하므로 패턴에 넣지 않는다.
HALLUCINATION_PATTERNS = [
    re.compile(r"(MBC|KBS|SBS|YTN|JTBC|TV\s*조선|채널\s*A|연합뉴스)", re.IGNORECASE),
    re.compile(r"뉴스\s*(입니다|였습니다|데스크|룸)"),
    re.compile(r"기자\s*(입니다|였습니다)"),
    re.compile(r"앵커"),
    re.compile(r"시청\s*(해|해주|해 주)"),
    re.compile(r"구독|좋아요|알림\s*설정"),
    re.compile(r"(자막|번역)\s*(제공|제작|by)", re.IGNORECASE),
    re.compile(r"한글\s*자막"),
    re.compile(r"다음\s*(영상|시간)에서\s*(만나|뵙)"),
    re.compile(r"오늘도\s*(함께|시청)"),
]


def is_hallucinated_text(text: str) -> bool:
    """STT 결과가 환각 단골 문구이거나 사실상 빈 발화이면 True."""
    stripped = (text or "").strip()
    if not stripped:
        return True
    return any(pattern.search(stripped) for pattern in HALLUCINATION_PATTERNS)


def is_silent_segments(segments) -> bool:
    """모든 세그먼트가 무음 확률이 높고 신뢰도가 낮으면 무음으로 간주한다.

    verbose_json 응답의 세그먼트별 no_speech_prob / avg_logprob 를 사용한다.
    세그먼트 정보가 없으면(구버전 응답 등) 판단을 보류하고 False 를 반환한다.
    """
    if not segments:
        return False
    return all(
        getattr(segment, "no_speech_prob", 0.0) > NO_SPEECH_PROB_THRESHOLD
        and getattr(segment, "avg_logprob", 0.0) < AVG_LOGPROB_THRESHOLD
        for segment in segments
    )


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TTS_TEXT_LENGTH)
    voice: str = "alloy"


class TranscriptionResponse(BaseModel):
    text: str


def synthesize_with_typecast(text: str) -> bytes:
    """Request Typecast audio while keeping the provider API key on the server."""
    api_key = os.getenv("TYPECAST_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Typecast TTS service is not configured.")

    tempo = 1.0

    payload = {
        "voice_id": TYPECAST_VOICE_ID,
        "text": text,
        "model": TYPECAST_MODEL,
        "prompt": {
            "emotion_type": "preset",
            "emotion_preset": "normal",
            "emotion_intensity": 1.0,
            "expressivity": 0.2,
        },
        "output": {"audio_format": "mp3", "audio_tempo": tempo},
    }
    request = Request(
        TYPECAST_TTS_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            raw_audio = response.read()
            content_type = response.headers.get_content_type()
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        raise HTTPException(status_code=502, detail=f"Typecast TTS request failed: {detail}") from exc
    except URLError as exc:
        raise HTTPException(status_code=502, detail="Typecast TTS service is unavailable.") from exc

    # Typecast may return the MP3 stream directly or a JSON/base64 envelope.
    if content_type.startswith("audio/"):
        return raw_audio

    data = json.loads(raw_audio.decode("utf-8"))
    encoded_audio = data.get("audio")
    if not isinstance(encoded_audio, str):
        raise HTTPException(status_code=502, detail="Typecast TTS returned no audio data.")
    try:
        return base64.b64decode(encoded_audio, validate=True)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Typecast TTS returned invalid audio data.") from exc


@router.post("/tts")
def text_to_speech(
    req: TTSRequest,
    _: UUID = Depends(get_current_user_id),
):
    """Synthesize an MP3 response without exposing the provider key to clients."""
    audio = synthesize_with_typecast(req.text)
    return StreamingResponse(iter([audio]), media_type="audio/mpeg")




@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    _: UUID = Depends(get_current_user_id),
):
    """Transcribe one short audio turn in memory and discard its original bytes immediately."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="음성 인식 서비스를 현재 사용할 수 없습니다.")

    audio_bytes = await file.read(MAX_AUDIO_BYTES + 1)
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="녹음 파일이 비어 있습니다.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="녹음 파일이 너무 큽니다.")

    try:
        client = OpenAI(api_key=api_key)
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=(file.filename or "recording.m4a", audio_bytes, file.content_type or "audio/m4a"),
            language="ko",
            response_format="verbose_json",  # 세그먼트별 no_speech_prob/avg_logprob 수신
            temperature=0,  # 환각 억제
        )

        # 2겹 방어: (1) 세그먼트 무음 확률  (2) 환각 문구 패턴
        # 둘 중 하나라도 걸리면 빈 문자열을 반환하여 프론트의 no-speech 경로가 처리하도록 한다.
        if is_silent_segments(getattr(result, "segments", None)) or is_hallucinated_text(result.text):
            return TranscriptionResponse(text="")

        return TranscriptionResponse(text=result.text)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception("STT(/speech/transcribe) 실패")
        raise HTTPException(status_code=502, detail="음성 인식 요청을 처리하지 못했습니다.") from exc
    finally:
        del audio_bytes
