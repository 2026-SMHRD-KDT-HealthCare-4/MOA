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

import base64
import os
import json
from datetime import datetime
from uuid import UUID
from openai import OpenAI

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_classic.memory import ConversationBufferWindowMemory
from langchain_community.vectorstores import SupabaseVectorStore
from supabase import create_client, Client

from app.core.database import get_db
from app.core.security import get_current_guardian, get_current_user_id, verify_senior_access
from app.models.models import ChatSession, Guardian, UrgentAlert
from app.routes.auth import get_family_guardian_ids, get_my_family_group_id
from app.schemas.chat import (
    ChatFrontendEnvelope,
    ChatMessageRequest,
    ChatSessionEndRequest,
    ChatSessionResponse,
    VoiceChatMessageResponseData,
)
from app.services.chatbot import chat_for_frontend, FRONTEND_CHAT_PROMPT
from app.services.deidentify import deidentify
from app.routes.speech import is_silent_segments, is_hallucinated_text, synthesize_with_typecast

# Supabase Vector Store 클라이언트 초기화
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_client: Client = create_client(supabase_url, supabase_key)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vector_store = SupabaseVectorStore(
    client=supabase_client,
    embedding=embeddings,
    table_name="documents",
    query_name="match_documents"
)

# LLM 구조화된 출력을 보장하는 스키마 Pydantic 정의
class DevChatResponseFormatSchema(BaseModel):
    reply: str = sa_Field if 'sa_Field' in globals() else Field(description="고령자에게 출력할 챗봇 응답 한국어 한문장")
    bot_emotion: str = sa_Field if 'sa_Field' in globals() else Field(description="모아 챗봇의 감정 (happy|worried|thinking|default|listening|clapping)")
    user_intent: str = sa_Field if 'sa_Field' in globals() else Field(description="사용자 발화 의도 (greeting|daily_talk|family_talk|meal_talk|positive_mood|negative_mood|health_discomfort|loneliness|goodbye|unknown)")
    should_end: bool = sa_Field if 'sa_Field' in globals() else Field(description="대화를 완전히 끝낼지 여부")


def _run_langchain_rag_inference(
    user_message: str,
    session: ChatSession,
    senior_id: UUID,
    db: Session,
) -> DevChatResponseFormatSchema:
    """Supabase Vector Store RAG와 LangChain ChatOpenAI를 활용하여 사용자 발화에 대한 응답을 생성합니다."""
    # 1. Supabase RAG 처리 (과거 기억 맥락 로드)
    context_str = ""
    try:
        docs = vector_store.similarity_search(user_message, k=2)
        context_str = "\n".join([doc.page_content for doc in docs])
    except Exception as e:
        print(f"⚠️ Supabase RAG 검색 실패: {e}")

    # 2. 슬라이딩 윈도우 메모리 구성
    memory = ConversationBufferWindowMemory(k=5, return_messages=True)
    messages_history = list(session.messages or [])
    for msg in messages_history[-10:]:
        role = "user" if msg["user"] == USER_SPEAKER else "assistant"
        memory.chat_memory.add_message(
            {"role": role, "content": msg["content"]}
        )

    # 3. LangChain ChatOpenAI 구동
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="API_KEY_NOT_FOUND")

    llm = ChatOpenAI(
        model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
        temperature=0.55,
        openai_api_key=api_key
    )

    topic_instruction = f"\n[과거 나눈 기억 맥락]\n{context_str}\n"
    system_instruction = FRONTEND_CHAT_PROMPT + topic_instruction

    # GPT 발신 메시지 조립
    from langchain_core.messages import SystemMessage, HumanMessage
    chat_msgs = [SystemMessage(content=system_instruction)]
    chat_msgs += memory.load_memory_variables({})["history"]
    chat_msgs.append(HumanMessage(content=user_message))

    try:
        # Pydantic 응답 스키마 강제 바인딩 (구조화된 출력)
        structured_llm = llm.with_structured_output(DevChatResponseFormatSchema)
        llm_reply = structured_llm.invoke(chat_msgs)
    except Exception:
        # 구조화에 실패할 경우 수동 폴백
        fallback_res = llm.invoke(chat_msgs)
        try:
            parsed = json.loads(fallback_res.content)
            llm_reply = DevChatResponseFormatSchema(
                reply=parsed.get("reply", fallback_res.content),
                bot_emotion=parsed.get("bot_emotion", "default"),
                user_intent=parsed.get("user_intent", "daily_talk"),
                should_end=parsed.get("should_end", False)
            )
        except Exception:
            llm_reply = DevChatResponseFormatSchema(
                reply=fallback_res.content,
                bot_emotion="default",
                user_intent="daily_talk",
                should_end=False
            )
    return llm_reply


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


def _normalize_frontend_result(result: dict, session_id: UUID | None = None) -> dict:
    """Return the single frontend chat contract, no legacy aliases."""
    action = str(result.get("next_action") or "continue")
    if action not in {"continue", "finish", "navigate", "urgent_alert"}:
        action = "continue"

    normalized = {
        "reply": str(result.get("reply") or "말씀해 주셔서 고마워요. 조금 더 들려주세요."),
        "user_intent": str(result.get("user_intent") or "unknown"),
        "bot_emotion": str(result.get("bot_emotion") or "default"),
        "next_action": action,
        "route": result.get("route") if isinstance(result.get("route"), str) else None,
        "conversation_topic": (
            result.get("conversation_topic")
            if isinstance(result.get("conversation_topic"), str)
            else None
        ),
        "question_index": (
            result.get("question_index")
            if isinstance(result.get("question_index"), int)
            else 0
        ),
    }
    if session_id is not None:
        normalized["session_id"] = str(session_id)
    return normalized


def _resolve_chat_senior_id(req: ChatMessageRequest, user_id: UUID, db: Session) -> UUID:
    """Use the requested senior after verifying direct-user or linked-guardian access."""
    verify_senior_access(user_id, req.senior_id, db)
    return req.senior_id


def _create_urgent_alert_if_needed(
    result: dict,
    senior_id: UUID,
    session_id: UUID,
    db: Session,
) -> None:
    if result.get("next_action") != "urgent_alert":
        return

    intent = str(result.get("user_intent") or "")
    level = "SUICIDE_RISK" if intent == "negative_mood" else "MEDICAL_EMERGENCY"
    rule_id = "CHAT_SUICIDE_RISK" if level == "SUICIDE_RISK" else "CHAT_MEDICAL_EMERGENCY"
    db.add(
        UrgentAlert(
            senior_id=senior_id,
            session_id=session_id,
            level=level,
            rule_id=rule_id,
        )
    )


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

    return {"status": "success", "data": _normalize_frontend_result(result)}


@router.post("", response_model=ChatFrontendEnvelope)
def send_message(
    req: ChatMessageRequest,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    senior_id = _resolve_chat_senior_id(req, user_id, db)

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

    # 1. LangChain 및 Supabase RAG 추론
    try:
        llm_reply = _run_langchain_rag_inference(req.message, session, senior_id, db)
    except Exception as e:
        llm_reply = DevChatResponseFormatSchema(
            reply="지금은 답을 바로 이어가기 어려워요. 잠시 후 다시 이야기해 주세요.",
            bot_emotion="worried",
            user_intent="unknown",
            should_end=False
        )

    # 2. 발화 비식별화 및 세션 저장 (JSONB 갱신 - flag_modified 적용)
    masked_user_msg = deidentify(req.message)
    reply_text = deidentify(llm_reply.reply)

    now_iso = datetime.utcnow().isoformat()
    updated_messages = list(session.messages or [])
    updated_messages.append({"user": USER_SPEAKER, "content": masked_user_msg, "time": now_iso})
    updated_messages.append({"user": BOT_SPEAKER, "content": reply_text, "time": now_iso})
    
    session.messages = updated_messages
    flag_modified(session, "messages")

    try:
        db.commit()
        db.refresh(session)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"대화 내용 DB 저장에 실패했습니다: {str(e)}")

    # 3. 발화 내용을 Supabase 벡터 DB에 장기 임베딩 적재 (RAG 장기 저장용)
    try:
        vector_store.add_texts(
            texts=[masked_user_msg],
            metadatas=[{
                "senior_id": str(senior_id),
                "session_id": str(session.session_id),
                "created_at": now_iso
            }]
        )
    except Exception as e:
        print(f"⚠️ Supabase pgvector 적재 실패: {e}")

    # 4. 결과 데이터 구성 및 긴급 경보 감지
    result = {
        "reply": reply_text,
        "user_intent": llm_reply.user_intent,
        "bot_emotion": llm_reply.bot_emotion,
        "next_action": "finish" if llm_reply.should_end else "continue",
        "route": None,
        "conversation_topic": req.current_topic,
        "question_index": req.question_index,
    }
    
    _create_urgent_alert_if_needed(result, senior_id, session.session_id, db)

    return {"status": "success", "data": result}


@router.post("/end", response_model=ChatSessionResponse)
def end_session(
    req: ChatSessionEndRequest,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    session = db.query(ChatSession).filter(ChatSession.session_id == req.session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="대화 세션을 찾을 수 없습니다.")
    verify_senior_access(user_id, session.senior_id, db)

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


@router.post("/voice", response_model=VoiceChatMessageResponseData)
async def send_voice_message(
    file: UploadFile = File(...),
    session_id: UUID | None = Form(None),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id)
):
    """음성 파일을 받아 STT, LangChain 대화 추론, Supabase 벡터 DB 적재, TTS 음성 합성을 단일 원스톱으로 처리한다."""
    senior_id = user_id

    # 1. STT 처리 (음성 바이트 -> Whisper 번역)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="음성 인식 서비스를 현재 사용할 수 없습니다.")

    # 25MB 파일 크기 가드
    MAX_AUDIO_BYTES = 25 * 1024 * 1024
    audio_bytes = await file.read(MAX_AUDIO_BYTES + 1)
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="녹음 파일이 비어 있습니다.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="녹음 파일이 너무 큽니다.")

    try:
        openai_client = OpenAI(api_key=api_key)
        result = openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=(file.filename or "recording.m4a", audio_bytes, file.content_type or "audio/m4a"),
            language="ko",
            response_format="verbose_json",
            temperature=0,
        )

        # 무음 및 환각 2겹 필터 가드
        if is_silent_segments(getattr(result, "segments", None)) or is_hallucinated_text(result.text):
            return VoiceChatMessageResponseData(
                session_id=session_id or UUID("00000000-0000-0000-0000-000000000000"),
                reply="",
                emotion="default",
                user_intent="unknown",
                user_message="",
                audio_base64=""
            )

        user_message = result.text
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"음성 변환 중 오류가 발생했습니다: {str(e)}")
    finally:
        del audio_bytes

    # 2. 대화 세션 취득 및 생성
    if session_id is not None:
        session = db.query(ChatSession).filter(
            ChatSession.session_id == session_id,
            ChatSession.senior_id == senior_id,
        ).first()
        if session is None:
            raise HTTPException(status_code=404, detail="대화 세션을 찾을 수 없습니다.")
    else:
        session = ChatSession(
            senior_id=senior_id,
            started_at=datetime.utcnow(),
            messages=[],
        )
        db.add(session)
        db.flush()  # session_id 발급 완료

    # 3. LangChain 및 Supabase RAG 추론
    try:
        llm_reply = _run_langchain_rag_inference(user_message, session, senior_id, db)
    except Exception as e:
        llm_reply = DevChatResponseFormatSchema(
            reply="지금은 답을 바로 이어가기 어려워요. 잠시 후 다시 이야기해 주세요.",
            bot_emotion="worried",
            user_intent="unknown",
            should_end=False
        )

    # 4. 발화 비식별화 및 세션 저장 (JSONB 갱신 - flag_modified 적용)
    masked_user_msg = deidentify(user_message)
    reply_text = deidentify(llm_reply.reply)

    now_iso = datetime.utcnow().isoformat()
    updated_messages = list(session.messages or [])
    updated_messages.append({"user": USER_SPEAKER, "content": masked_user_msg, "time": now_iso})
    updated_messages.append({"user": BOT_SPEAKER, "content": reply_text, "time": now_iso})
    
    session.messages = updated_messages
    flag_modified(session, "messages")  # JSONB 더티 갱신 감지 명시

    try:
        db.commit()
        db.refresh(session)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"대화 내용 DB 저장에 실패했습니다: {str(e)}")

    # 5. 발화 내용을 Supabase 벡터 DB에 장기 임베딩 적재 (RAG 장기 저장용)
    try:
        vector_store.add_texts(
            texts=[masked_user_msg],
            metadatas=[{
                "senior_id": str(senior_id),
                "session_id": str(session.session_id),
                "created_at": now_iso
            }]
        )
    except Exception as e:
        print(f"⚠️ Supabase pgvector 적재 실패: {e}")

    # 6. TTS 음성 합성
    audio_base64 = ""
    if reply_text:
        try:
            tts_audio = synthesize_with_typecast(reply_text)
            audio_base64 = base64.b64encode(tts_audio).decode("utf-8")
        except Exception as e:
            print(f"⚠️ TTS 음성 합성 실패: {e}")

    return VoiceChatMessageResponseData(
        session_id=session.session_id,
        reply=reply_text,
        emotion=llm_reply.bot_emotion,
        user_intent=llm_reply.user_intent,
        user_message=user_message,
        audio_base64=audio_base64
    )
