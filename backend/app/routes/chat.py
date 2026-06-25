"""
AI 챗봇 안부 대화 라우터 — 요구사항 6, 13, 14번

- 대화는 CHAT_SESSION 1건(session_id)에 messages(JSONB)로 누적 저장한다.
- 저장 전 발화는 비식별화(app/services/deidentify.py)를 거친다. 단, 이름은 제외하고
  생년월일/주소/전화번호만 [MASK] 처리한다. (정규식으로 이름을 안정적으로 구분하기
  어려워 오탐/미탐 위험이 크기 때문)
- 이 라우터/모델은 VOICE_FEATURE, RISK_PREDICTION 과 senior_id 기준으로 직접 JOIN하지
  않는다 (요구사항 14번). 두 데이터가 동시에 필요한 화면(예: 통합 리포트)에서는 각각
  별도 쿼리로 조회한 뒤 애플리케이션 코드에서 병합한다.
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_guardian, get_current_user_id, verify_senior_access
from app.models.models import ChatSession, Guardian, UrgentAlert
from app.routes.auth import get_family_guardian_ids, get_my_family_group_id
from app.schemas.chat import (
    ChatMessageRequest,
    ChatMessageResponseData,
    ChatSessionEndRequest,
    ChatSessionResponse,
)
from app.services.chatbot import chat_for_frontend, chat_with_gpt
from app.services.deidentify import deidentify

router = APIRouter(prefix="/chat", tags=["chat"])

USER_SPEAKER = 0
BOT_SPEAKER = 1

# 한 세션에 누적할 대화 내역 중 GPT에 전달할 최근 메시지 수
HISTORY_WINDOW = 10


class DevChatRequest(BaseModel):
    message: str
    conversation_turn: int | None = None
    valid_speech_duration_ms: int | None = None
    acoustic_meta: dict | None = None
    history: list[dict[str, str]] = Field(default_factory=list)
    current_topic: str | None = None
    question_index: int = 0


class DevChatResponse(BaseModel):
    status: str
    data: dict


@router.post("/dev", response_model=DevChatResponse)
def send_dev_message(req: DevChatRequest):
    """개발 테스트용 챗봇 라우트. 인증/DB 저장 없이 LLM 응답만 확인한다."""
    try:
        history = [
            {"role": item["role"], "content": item["content"]}
            for item in req.history[-8:]
            if item.get("role") in ("user", "assistant") and item.get("content")
        ]
        result = chat_for_frontend(req.message, history, req.current_topic, req.question_index)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GPT 오류: {str(e)}")

    return {"status": "success", "data": result}


@router.post("", response_model=ChatMessageResponseData)
def send_message(
    req: ChatMessageRequest,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    senior_id = user_id  # 토큰의 본인 ID 사용 (guardian·senior 공통, req.senior_id는 신뢰하지 않음)

    if req.session_id is not None:
        session = (
            db.query(ChatSession)
            .filter(
                ChatSession.session_id == req.session_id,
                ChatSession.senior_id == senior_id,
            )
            .first()
        )
        if session is None:
            raise HTTPException(status_code=404, detail="대화 세션을 찾을 수 없습니다.")
    else:
        session = ChatSession(
            senior_id=senior_id,
            started_at=datetime.utcnow(),
            messages=[],
        )
        db.add(session)
        db.flush()  # session_id 확정

    # 1. 사용자 발화 비식별화(생년월일/주소/전화번호) 후 누적
    masked_message = deidentify(req.message)
    now_iso = datetime.utcnow().isoformat()

    messages = list(session.messages or [])
    messages.append({"user": USER_SPEAKER, "content": masked_message, "time": now_iso})

    # 2. GPT 호출용 history 구성 (최근 N개, role 매핑)
    history = [
        {"role": "user" if m["user"] == USER_SPEAKER else "assistant", "content": m["content"]}
        for m in messages[-HISTORY_WINDOW:]
    ]

    try:
        result = chat_with_gpt(req.message, history[:-1])  # 마지막(이번 입력)은 별도 전달
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GPT 오류: {str(e)}")

    # 3. 봇 응답도 비식별화(생년월일/주소/전화번호) 후 누적
    reply = deidentify(result["message"])
    messages.append(
        {"user": BOT_SPEAKER, "content": reply, "time": datetime.utcnow().isoformat()}
    )

    session.messages = messages

    try:
        db.commit()
        db.refresh(session)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"대화 세션 저장 실패: {str(e)}")

    return ChatMessageResponseData(
        session_id=session.session_id,
        reply=reply,
        emotion=result.get("emotion"),
        score=result.get("score"),
        status=result.get("status"),
    )


@router.post("/end", response_model=ChatSessionResponse)
def end_session(
    req: ChatSessionEndRequest,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    session = db.query(ChatSession).filter(ChatSession.session_id == req.session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="대화 세션을 찾을 수 없습니다.")
    if session.senior_id != user_id:
        raise HTTPException(status_code=403, detail="본인의 대화 세션만 종료할 수 있습니다.")

    session.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session


@router.get("/history/{senior_id}", response_model=list[ChatSessionResponse])
def get_history(
    senior_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """고령층의 대화 세션 목록 (최근 30건). 본인 또는 연동 보호자만 조회 가능."""
    verify_senior_access(user_id, senior_id, db)
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.senior_id == senior_id)
        .order_by(ChatSession.started_at.desc())
        .limit(30)
        .all()
    )
    return sessions


@router.get("/session/{session_id}", response_model=ChatSessionResponse)
def get_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="대화 세션을 찾을 수 없습니다.")
    verify_senior_access(user_id, session.senior_id, db)
    return session


@router.post("/alert/{alert_id}/cancel")
def cancel_urgent_alert(
    alert_id: UUID,
    db: Session = Depends(get_db),
    guardian: Guardian = Depends(get_current_guardian),
):
    """보호자가 오탐으로 판단한 긴급 알림을 취소한다.

    레코드 자체는 삭제하지 않고 alert_status 를 'cancelled'로 변경만 한다 (감사 로그 보존).
    취소 권한: 해당 senior 와 ACTIVE 연동된 보호자만 가능.
    """
    alert = db.query(UrgentAlert).filter(UrgentAlert.alert_id == alert_id).first()
    if alert is None:
        raise HTTPException(status_code=404, detail="긴급 알림을 찾을 수 없습니다.")

    # 가족 그룹의 ACTIVE 보호자 중 누군가가 해당 senior 와 연동돼 있는지 확인
    from app.models.models import GuardianSenior, LinkStatus
    family_group_id = get_my_family_group_id(db, guardian)
    family_guardian_ids = get_family_guardian_ids(db, family_group_id)
    link = (
        db.query(GuardianSenior)
        .filter(
            GuardianSenior.guardian_id.in_(family_guardian_ids),
            GuardianSenior.senior_id == alert.senior_id,
            GuardianSenior.link_status == LinkStatus.ACTIVE.value,
        )
        .first()
    )
    if link is None:
        raise HTTPException(status_code=403, detail="연동된 보호자만 취소할 수 있습니다.")

    if alert.alert_status == "cancelled":
        raise HTTPException(status_code=400, detail="이미 취소된 알림입니다.")

    alert.alert_status = "cancelled"
    db.commit()
    db.refresh(alert)

    return {
        "status": "success",
        "alert_id": str(alert.alert_id),
        "alert_status": alert.alert_status,
    }
