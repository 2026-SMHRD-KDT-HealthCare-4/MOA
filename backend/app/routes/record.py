"""
지정문구 / 지정문구 낭독 기록 라우터 — 요구사항 5번

- SCRIPT: 고령층이 매일 낭독하는 지정 문구 원본 (관리자/운영 등록)
- SCRIPT_RECORD: 고령층의 낭독 측정 이력 (원본 음성은 저장하지 않음, 측정 시각만 기록)

※ 실제 음성 특징 벡터 저장은 /analyze 라우터(VOICE_FEATURE)가 전담한다.
  이 라우터는 "오늘의 문구 조회"와 "낭독했다는 이력 기록"만 담당한다.
"""

from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user_id, verify_senior_access
from app.models.models import Script, ScriptRecord
from app.schemas.voice import ScriptRecordCreateRequest, ScriptRecordResponse, ScriptResponse

router = APIRouter(prefix="/record", tags=["record"])


def _select_script_for_date(scripts: list[Script], target_date: date) -> Script:
    """날짜를 시드로 문구 풀을 순환 배정한다.

    문구 풀(예: 3~5개)을 created_at 오름차순으로 고정한 뒤, 날짜의 ordinal 값을
    풀 크기로 나눈 나머지를 인덱스로 사용한다. 인접한 날짜는 인덱스가 1씩 증가하므로
    풀 크기가 3 이상이면 어제/오늘/내일이 항상 서로 다른 문구가 된다.
    """
    index = target_date.toordinal() % len(scripts)
    return scripts[index]


@router.get("/script/today", response_model=ScriptResponse)
def get_today_script(
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """오늘 제공할 지정문구를 조회한다.

    문구 풀(3~5개, created_at 오름차순 고정)에서 날짜 기준으로 순환 배정하여
    어제/오늘/내일이 서로 겹치지 않도록 한다.
    """
    scripts = db.query(Script).order_by(Script.created_at.asc()).all()
    if not scripts:
        raise HTTPException(status_code=404, detail="등록된 지정문구가 없습니다.")

    return _select_script_for_date(scripts, datetime.utcnow().date())


@router.get("/script/{script_id}", response_model=ScriptResponse)
def get_script(
    script_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    script = db.query(Script).filter(Script.script_id == script_id).first()
    if script is None:
        raise HTTPException(status_code=404, detail="지정문구를 찾을 수 없습니다.")
    return script


@router.post("/script-record", response_model=ScriptRecordResponse)
def create_script_record(
    req: ScriptRecordCreateRequest,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """로그인한 사용자(고령층·보호자 공통)의 지정 문구 낭독 측정 이력을 저장한다 (원본 음성 미저장)."""
    script = db.query(Script).filter(Script.script_id == req.script_id).first()
    if script is None:
        raise HTTPException(status_code=404, detail="지정문구를 찾을 수 없습니다.")

    record = ScriptRecord(
        senior_id=user_id,  # 토큰 본인 ID 사용 (guardian·senior 공통)
        script_id=req.script_id,
        measured_at=req.measured_at or datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/script-record/{senior_id}", response_model=list[ScriptRecordResponse])
def list_script_records(
    senior_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """고령층의 지정 문구 낭독 이력 목록 (최근 30건). 본인 또는 연동 보호자만 조회 가능."""
    verify_senior_access(user_id, senior_id, db)
    records = (
        db.query(ScriptRecord)
        .filter(ScriptRecord.senior_id == senior_id)
        .order_by(ScriptRecord.measured_at.desc())
        .limit(30)
        .all()
    )
    return records
