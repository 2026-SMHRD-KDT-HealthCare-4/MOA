"""Speech API routes.

The mobile client never needs to hold an OpenAI API key: authenticated users ask
this route to synthesize short Moa responses and receive an MP3 stream.
"""

import base64
import json
import os
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
        "output": {"audio_format": "mp3", "audio_tempo": 0.9},
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

    # Legacy OpenAI implementation retained below temporarily for a focused provider swap.
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="음성 합성 서비스를 현재 사용할 수 없습니다.")

    try:
        client = OpenAI(api_key=api_key)
        response = client.audio.speech.create(
            # ballad 같은 최신 음성은 gpt-4o-mini-tts 모델에서 지원한다.
            model=os.getenv("OPENAI_TTS_MODEL", "gpt-4o-mini-tts"),
            voice=req.voice,
            input=req.text,
        )
        return StreamingResponse(response.iter_bytes(), media_type="audio/mpeg")
    except Exception:
        raise HTTPException(status_code=502, detail="음성 합성 요청을 처리하지 못했습니다.")


@router.post("/dev/tts")
def dev_text_to_speech(req: TTSRequest):
    """Local mock-login route. Production clients must use authenticated /speech/tts."""
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
        )
        return TranscriptionResponse(text=result.text)
    except Exception:
        raise HTTPException(status_code=502, detail="음성 인식 요청을 처리하지 못했습니다.")
    finally:
        del audio_bytes
