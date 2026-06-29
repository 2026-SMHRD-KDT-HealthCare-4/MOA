"""챗봇 장기 기억 서비스 (텍스트 기반).

이미 대화를 저장 중인 chat_session 테이블을 시간순으로 조회해, 과거 대화를
챗봇 프롬프트에 주입할 텍스트로 만든다. 임베딩/벡터 검색을 쓰지 않는다.

[설계]
- 별도 저장소를 만들지 않는다. chat_session(JSONB messages)이 곧 장기 기억의 원본이다.
- 같은 senior_id 의 과거 세션만 조회한다(사용자 격리).
- chat_session 은 senior_id 에 FK 가 없고(물리 분리 대비),
  VOICE_FEATURE / RISK_PREDICTION 과 JOIN 하지 않는다. 이 서비스도 그 규칙을 지킨다.

[정책 합의 2026-06-26 — chat_session 에 그대로 적용]
- 정책2(보관): 30일 경과 세션 자동 삭제(scheduler). 여기서는 조회 시에도 30일 이내만 본다.
- 정책3(삭제): 탈퇴 시 chat_session 을 코드로 함께 삭제(별도 cascade 없음).
- 정책4(접근): 챗봇 응답 생성에만 사용. 보호자/화면 노출 금지.
"""

from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.models import ChatSession

# 조회 파라미터
RECENT_SESSION_LIMIT = 3      # 가져올 과거 세션 수 (현재 진행 중 세션 제외)
MESSAGES_PER_SESSION = 6      # 세션당 가져올 최근 메시지 수 (너무 길면 프롬프트 과부하)
RETENTION_DAYS = 30          # 정책2: 30일 이내 세션만 기억으로 사용

USER_SPEAKER = 0
BOT_SPEAKER = 1


def get_recent_memory(
    db: Session,
    senior_id: UUID,
    exclude_session_id: UUID | None = None,
) -> list[dict]:
    """해당 사용자의 최근 과거 대화 세션들을 시간순(최신 우선)으로 조회한다.

    - exclude_session_id: 지금 진행 중인 세션은 장기 기억에서 제외(단기 기억이 이미 담당).
    - 30일(RETENTION_DAYS) 이내 세션만 본다.
    반환: [{started_at, messages(list)}, ...] (최신 세션이 먼저)
    """
    cutoff = datetime.utcnow() - timedelta(days=RETENTION_DAYS)

    query = (
        db.query(ChatSession)
        .filter(
            and_(
                ChatSession.senior_id == senior_id,
                ChatSession.started_at >= cutoff,
            )
        )
        .order_by(ChatSession.started_at.desc())
    )
    if exclude_session_id is not None:
        query = query.filter(ChatSession.session_id != exclude_session_id)

    sessions = query.limit(RECENT_SESSION_LIMIT).all()

    result = []
    for s in sessions:
        msgs = list(s.messages or [])
        # 세션당 마지막 N개 메시지만(맥락의 핵심은 보통 뒤쪽)
        result.append(
            {
                "started_at": s.started_at,
                "messages": msgs[-MESSAGES_PER_SESSION:],
            }
        )
    return result


def build_memory_context(memory_sessions: list[dict]) -> str:
    """조회된 과거 세션들을 프롬프트에 주입할 한 덩어리 텍스트로 만든다.

    기억이 없으면 빈 문자열을 반환한다(불필요한 안내가 프롬프트에 붙지 않도록).
    날짜와 발화자만 간단히 표기하고, 점수/진단 같은 민감 수치는 넣지 않는다.
    """
    if not memory_sessions:
        return ""

    blocks = []
    for sess in memory_sessions:
        when = sess["started_at"].strftime("%m월 %d일")
        lines = []
        for m in sess["messages"]:
            who = "어르신" if m.get("user") == USER_SPEAKER else "모아"
            content = (m.get("content") or "").strip()
            if content:
                lines.append(f"  {who}: {content}")
        if lines:
            blocks.append(f"[{when} 대화]\n" + "\n".join(lines))

    if not blocks:
        return ""

    body = "\n\n".join(blocks)
    return (
        "\n[이 어르신과의 지난 대화 기록]\n"
        f"{body}\n"
        "위 내용이 지금 대화와 자연스럽게 이어질 때만 부드럽게 언급하세요. "
        "억지로 꺼내지 말고, 어르신이 반복해서 말해도 핀잔하지 마세요.\n"
    )


def delete_sessions_for_senior(db: Session, senior_id: UUID) -> int:
    """탈퇴 시 해당 사용자의 모든 대화 세션을 삭제한다(정책3 — 코드 레벨 처리).

    FK cascade 가 없으므로(물리 분리 대비) 탈퇴 처리 코드에서 이 함수를 호출한다.
    삭제된 세션 수를 반환한다.
    """
    deleted = (
        db.query(ChatSession)
        .filter(ChatSession.senior_id == senior_id)
        .delete(synchronize_session=False)
    )
    return deleted