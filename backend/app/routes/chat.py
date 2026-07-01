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
    ChatFrontendEnvelope,
    ChatFrontendData,
)
from app.services.chatbot import chat_for_frontend
from app.services.deidentify import deidentify
from app.services.long_term_memory import get_recent_memory, build_memory_context

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
    print(f"\n[chat.py/send_message] >>> 요청 수신. user_id={user_id}, message='{req.message}'")
    senior_id = user_id  # 토큰의 본인 ID 사용 (guardian·senior 공통, req.senior_id는 신뢰하지 않음)

    if req.session_id is not None:
        print(f"[chat.py/send_message] 기존 세션 ID 사용: {req.session_id}")
        session = (
            db.query(ChatSession)
            .filter(
                ChatSession.session_id == req.session_id,
                ChatSession.senior_id == senior_id,
            )
            .first()
        )
        if session is None:
            print("[chat.py/send_message] ❌ 에러: 세션을 찾을 수 없음")
            raise HTTPException(status_code=404, detail="대화 세션을 찾을 수 없습니다.")
    else:
        print("[chat.py/send_message] 신규 세션 시작")
        session = ChatSession(
            senior_id=senior_id,
            started_at=datetime.utcnow(),
            messages=[],
        )
        db.add(session)
        db.flush()  # session_id 확정
        print(f"[chat.py/send_message] 신규 세션 생성 완료. ID: {session.session_id}")

    # 1. 사용자 발화 비식별화(생년월일/주소/전화번호) 후 누적
    masked_message = deidentify(req.message)
    now_iso = datetime.utcnow().isoformat()

    messages = list(session.messages or [])
    messages.append({"user": USER_SPEAKER, "content": masked_message, "time": now_iso})

    # 2. GPT 호출용 history 구성 (최근 N개, role 매핑)
    #    이번 사용자 발화는 chat_for_frontend 에 message 로 따로 전달하므로 history 에선 제외.
    history = [
        {"role": "user" if m["user"] == USER_SPEAKER else "assistant", "content": m["content"]}
        for m in messages[:-1][-HISTORY_WINDOW:]
    ]

    # 2-1. 장기 기억 주입: 이 사용자의 과거 대화 세션(현재 세션 제외)을 조회해 프롬프트용 컨텍스트로 만든다.
    #      조회/생성 실패가 채팅을 막지 않도록 예외는 흡수하고 빈 컨텍스트로 진행한다.
    print("[chat.py/send_message] Supabase 장기 기억(RAG) 조회 시도...")
    try:
        memory_sessions = get_recent_memory(db, senior_id, exclude_session_id=session.session_id)
        memory_context = build_memory_context(memory_sessions)
        print(f"[chat.py/send_message] 장기 기억 조회 완료. 컨텍스트 길이: {len(memory_context)} 자")
    except Exception as e:
        print(f"[chat.py/send_message] ⚠️ 장기 기억 조회 실패 (예외 흡수 및 빈 컨텍스트 진행): {e}")
        memory_context = ""

    print("[chat.py/send_message] GPT 추론(chat_for_frontend) 호출...")
    try:
        result = chat_for_frontend(
            req.message,
            history=history,
            memory_context=memory_context,
        )
        print(f"[chat.py/send_message] GPT 추론 성공. 결과 reply: '{result.get('reply')}'")
    except Exception as e:
        print(f"[chat.py/send_message] ❌ 에러: GPT 추론 실패: {e}")
        raise HTTPException(status_code=500, detail=f"GPT 오류: {str(e)}")

    # 3. 봇 응답도 비식별화(생년월일/주소/전화번호) 후 누적
    #    chat_for_frontend 는 'reply' 키로 응답한다(구버전 chat_with_gpt 의 'message' 가 아님).
    reply = deidentify(result.get("reply", ""))
    messages.append(
        {"user": BOT_SPEAKER, "content": reply, "time": datetime.utcnow().isoformat()}
    )

    session.messages = messages

    print("[chat.py/send_message] 대화 상태 DB 저장(Commit) 시도...")
    try:
        db.commit()
        db.refresh(session)
        print("[chat.py/send_message] DB 저장 성공.")
    except Exception as e:
        print(f"[chat.py/send_message] ❌ 에러: DB 저장 실패: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"대화 세션 저장 실패: {str(e)}")

    # response_model 이 ChatFrontendEnvelope 이므로 envelope({status, data}) 형태로 반환한다.
    # ChatFrontendData 에 대화 제어 필드(next_action·question_index 등)가 모두 포함된다.
    return ChatFrontendEnvelope(
        status="success",
        data=ChatFrontendData(
            reply=reply,
            user_intent=result.get("user_intent", "unknown"),
            bot_emotion=result.get("bot_emotion", "default"),
            next_action=result.get("next_action", "continue"),
            route=result.get("route"),
            conversation_topic=result.get("conversation_topic"),
            question_index=result.get("question_index", 0),
            session_id=session.session_id,
        ),
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