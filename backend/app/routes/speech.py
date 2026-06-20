"""Speech API routes.

The mobile client never needs to hold an OpenAI API key: authenticated users ask
this route to synthesize short Moa responses and receive an MP3 stream.
"""

import os
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel, Field

from app.core.security import get_current_user_id

router = APIRouter(prefix="/speech", tags=["speech"])

MAX_TTS_TEXT_LENGTH = 500
MAX_AUDIO_BYTES = 25 * 1024 * 1024


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TTS_TEXT_LENGTH)
    voice: str = "nova"


class TranscriptionResponse(BaseModel):
    text: str


@router.post("/tts")
def text_to_speech(
    req: TTSRequest,
    _: UUID = Depends(get_current_user_id),
):
    """Synthesize an MP3 response without exposing the provider key to clients."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="음성 합성 서비스를 현재 사용할 수 없습니다.")

    try:
        client = OpenAI(api_key=api_key)
        response = client.audio.speech.create(
            model="tts-1",
            voice=req.voice,
            input=req.text,
        )
        return StreamingResponse(response.iter_bytes(), media_type="audio/mpeg")
    except Exception:
        raise HTTPException(status_code=502, detail="음성 합성 요청을 처리하지 못했습니다.")


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
