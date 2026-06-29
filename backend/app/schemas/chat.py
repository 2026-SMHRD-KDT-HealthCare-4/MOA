"""
챗봇 대화 세션 관련 요청·응답 스키마
"""

from datetime import datetime
from typing import Any, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ChatMessageRequest(BaseModel):
    senior_id: UUID
    session_id: Optional[UUID] = None  # 미지정 시 새 세션 시작
    message: str
    history: list[dict[str, str]] = Field(default_factory=list)
    current_topic: Optional[str] = None
    question_index: int = 0


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
    user_intent: Optional[str] = None
    bot_emotion: Optional[str] = None
    next_action: Optional[str] = None
    route: Optional[str] = None
    conversation_topic: Optional[str] = None
    question_index: Optional[int] = None


class ChatFrontendData(BaseModel):
    reply: str
    user_intent: str
    bot_emotion: str
    next_action: Literal["continue", "finish", "navigate", "urgent_alert"] = "continue"
    route: Optional[str] = None
    conversation_topic: Optional[str] = None
    question_index: int = 0
    session_id: UUID


class ChatFrontendEnvelope(BaseModel):
    status: Literal["success"]
    data: ChatFrontendData


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
