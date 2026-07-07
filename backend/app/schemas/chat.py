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
    # 프론트 대화 제어 필드 — useMoaChat.normalizeChatbotResponse 가 참조한다.
    # 누락되면 프론트가 기본값으로 떨어져(next_action="continue", question_index=0 등)
    # 대화가 finish 로 끝나지 않거나 주제/질문 추적이 겉돈다.
    user_intent: Optional[str] = None
    bot_emotion: Optional[str] = None
    next_action: Optional[str] = None
    route: Optional[str] = None
    conversation_topic: Optional[str] = None
    question_index: Optional[int] = None


class VoiceChatMessageResponseData(BaseModel):
    session_id: UUID
    reply: str
    emotion: str
    user_message: str
    audio_base64: str
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
    source: Optional[str] = None
    override_reason: Optional[str] = None
    session_id: UUID


class ChatFrontendEnvelope(BaseModel):
    status: Literal["success"]
    data: ChatFrontendData


class ChatSessionStartResponse(BaseModel):
    session_id: UUID
    started_at: datetime


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


# 프론트가 먼저 말한 오프닝/인사 등 assistant 문장을 세션 대화기록에 1건 추가한다.
# (LLM이 직전 오프닝을 인지해 반복 질문을 줄이도록. 음성검사 지시/안내문은 저장 대상 아님)
class ChatSessionAppendRequest(BaseModel):
    session_id: UUID
    content: str
