"""
챗봇 대화 세션 관련 요청·응답 스키마
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class ChatMessageRequest(BaseModel):
    senior_id: UUID
    session_id: Optional[UUID] = None  # 미지정 시 새 세션 시작
    message: str


class ChatMessageItem(BaseModel):
    user: int  # 0: 고령층(사용자), 1: 봇
    content: str
    time: str


class ChatMessageResponseData(BaseModel):
    session_id: UUID
    reply: str
    emotion: Optional[str] = None
    score: Optional[int] = None
    status: Optional[str] = None


class ChatSessionResponse(BaseModel):
    session_id: UUID
    senior_id: UUID
    started_at: datetime
    ended_at: Optional[datetime]
    messages: List[ChatMessageItem]
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionEndRequest(BaseModel):
    session_id: UUID
