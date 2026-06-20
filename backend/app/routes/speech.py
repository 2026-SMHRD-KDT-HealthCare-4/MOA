"""Speech API routes.

The mobile client never needs to hold an OpenAI API key: authenticated users ask
this route to synthesize short Moa responses and receive an MP3 stream.
"""

import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel, Field

from app.core.security import get_current_user_id

router = APIRouter(prefix="/speech", tags=["speech"])

MAX_TTS_TEXT_LENGTH = 500


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TTS_TEXT_LENGTH)
    voice: str = "nova"


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
