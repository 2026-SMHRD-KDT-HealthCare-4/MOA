"""
팀 모아 — 다중 질환 음성 스크리닝 FastAPI 서버
구조: BR(Binary Relevance) — 질환별 엔드포인트가 서로 완전히 독립
1차 배포 범위: 파킨슨 / 치매 / 당뇨(남/여)
추가 검토 대상: ALS

ZDR(Zero Data Retention): 업로드된 WAV는 임시 파일로만 처리되고
추론이 끝나는 즉시 삭제된다 (저장하지 않음).
"""
import os
import tempfile
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from inference.feature_extraction import extract_all_acoustic_features
from inference.hubert_extraction import load_hubert
from inference.byols_extraction import load_byols_model
from inference import parkinson, dementia, diabetes


# ──────────────────────────────────────────────────────────
# 서버 시작 시 모든 모델을 1회만 로드 (요청마다 로드하면 느려짐)
# ──────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 50)
    print("🚀 팀 모아 음성 스크리닝 서버 — 모델 로딩 시작")
    print("=" * 50)
    parkinson.load_parkinson_models()
    dementia.load_dementia_models()
    diabetes.load_diabetes_models()
    load_hubert()
    try:
        load_byols_model()
    except Exception as e:
        print(f"⚠️  BYOL-S 모델 로드 실패 — 당뇨 엔드포인트는 임베딩 직접 입력 방식만 사용 가능")
        print(f"   ({e})")
    print("✅ 모든 모델 로드 완료 — 서버 준비됨")
    yield
    print("🛑 서버 종료")


app = FastAPI(
    title="팀 모아 음성 스크리닝 API",
    description="음성 기반 다중 질환 스크리닝 (BR 구조) — 파킨슨/치매/당뇨 1차 배포",
    version="1.0.0",
    lifespan=lifespan,
)


# ──────────────────────────────────────────────────────────
# 공통 유틸 — 업로드 WAV를 임시 파일로 저장 (ZDR: 처리 후 자동 삭제)
# ──────────────────────────────────────────────────────────
async def _save_temp_wav(file: UploadFile) -> str:
    suffix = os.path.splitext(file.filename or "audio.wav")[1] or ".wav"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    content = await file.read()
    tmp.write(content)
    tmp.close()
    return tmp.name


def _cleanup_temp_files(*paths: str):
    for p in paths:
        try:
            if p and os.path.exists(p):
                os.remove(p)
        except Exception:
            pass


@app.get("/")
async def root():
    return {
        "service": "팀 모아 음성 스크리닝 API",
        "status": "running",
        "available_endpoints": [
            "/predict/parkinson",
            "/predict/dementia",
            "/predict/diabetes",
        ],
    }


# ══════════════════════════════════════════════════════════
# 1. 파킨슨 — 단일 모델, 단일 WAV(모음 발성)
# ══════════════════════════════════════════════════════════
@app.post("/predict/parkinson")
async def predict_parkinson_endpoint(file: UploadFile = File(...)):
    tmp_path = await _save_temp_wav(file)
    try:
        raw_features = extract_all_acoustic_features(tmp_path)
        result = parkinson.predict_parkinson(raw_features)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파킨슨 예측 중 오류: {str(e)}")
    finally:
        _cleanup_temp_files(tmp_path)  # ZDR — 추론 후 즉시 삭제


# ══════════════════════════════════════════════════════════
# 2. 치매 — 과제별(CTD/PFT/SFT) 모델, 1개~3개 WAV 모두 지원
#    multipart로 과제명을 key로 하는 파일들을 받는다.
#    (예: form-data에 "CTD"라는 필드명으로 파일 첨부)
# ══════════════════════════════════════════════════════════
@app.post("/predict/dementia")
async def predict_dementia_endpoint(
    CTD: Optional[UploadFile] = File(None),
    PFT: Optional[UploadFile] = File(None),
    SFT: Optional[UploadFile] = File(None),
):
    provided = {"CTD": CTD, "PFT": PFT, "SFT": SFT}
    provided = {k: v for k, v in provided.items() if v is not None}

    if not provided:
        raise HTTPException(
            status_code=400,
            detail="최소 1개 과제(CTD/PFT/SFT)의 WAV 파일이 필요합니다.",
        )

    tmp_paths = {}
    try:
        wav_paths_by_task = {}
        raw_features_by_task = {}

        for task, upload in provided.items():
            tmp_path = await _save_temp_wav(upload)
            tmp_paths[task] = tmp_path
            wav_paths_by_task[task] = tmp_path
            raw_features_by_task[task] = extract_all_acoustic_features(tmp_path)

        result = dementia.predict_dementia(wav_paths_by_task, raw_features_by_task)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"치매 예측 중 오류: {str(e)}")
    finally:
        _cleanup_temp_files(*tmp_paths.values())  # ZDR


# ══════════════════════════════════════════════════════════
# 3. 당뇨 — BYOL-S 임베딩 기반, 남성/여성 분리 모델
#    이제 서버에서 WAV → BYOL-S 임베딩을 직접 추출한다 (다른 질환과 동일한 UX).
#    BYOL-S 모델 로드에 실패한 경우(체크포인트 미설치 등)를 대비해
#    "이미 추출된 임베딩을 직접 보내는" 호환 엔드포인트도 함께 둔다.
# ══════════════════════════════════════════════════════════
@app.post("/predict/diabetes")
async def predict_diabetes_endpoint(
    file: UploadFile = File(...),
    age: float = Form(...),
    bmi: float = Form(...),
    gender: str = Form(...),
):
    """WAV 파일을 직접 업로드 — 서버에서 BYOL-S 임베딩 추출 후 예측"""
    if gender not in ("male", "female"):
        raise HTTPException(status_code=400, detail="gender는 'male' 또는 'female'이어야 합니다.")

    tmp_path = await _save_temp_wav(file)
    try:
        result = diabetes.predict_diabetes_from_wav(tmp_path, age, bmi, gender)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"당뇨 예측 중 오류: {str(e)}")
    finally:
        _cleanup_temp_files(tmp_path)  # ZDR


class DiabetesEmbeddingRequest(BaseModel):
    byols_embedding: list[float]  # 길이 2048
    age: float
    bmi: float
    gender: str  # "male" or "female"


@app.post("/predict/diabetes/from_embedding")
async def predict_diabetes_from_embedding_endpoint(req: DiabetesEmbeddingRequest):
    """
    [호환용] BYOL-S 임베딩을 이미 직접 추출해서 가지고 있는 경우 사용.
    BYOL-S 모델/체크포인트가 서버에 없을 때의 대안 경로이기도 함.
    """
    if len(req.byols_embedding) != 2048:
        raise HTTPException(
            status_code=400,
            detail=f"byols_embedding은 2048차원이어야 합니다 (입력: {len(req.byols_embedding)}차원).",
        )
    try:
        result = diabetes.predict_diabetes(req.byols_embedding, req.age, req.bmi, req.gender)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"당뇨 예측 중 오류: {str(e)}")


# ══════════════════════════════════════════════════════════
# (선택) 통합 엔드포인트 — 여러 질환을 한 번에 스크리닝하고 싶을 때
# 파킨슨용 WAV 1개만으로 파킨슨+치매(CTD 대용)를 동시에 보고 싶은 경우 등에 사용
# ZDR을 위해 각 추론 후 임시파일을 즉시 정리한다.
# ══════════════════════════════════════════════════════════
@app.post("/predict/all")
async def predict_all_endpoint(
    parkinson_wav: Optional[UploadFile] = File(None),
    dementia_CTD: Optional[UploadFile] = File(None),
    dementia_PFT: Optional[UploadFile] = File(None),
    dementia_SFT: Optional[UploadFile] = File(None),
):
    results = {}
    tmp_paths = []

    try:
        if parkinson_wav is not None:
            p = await _save_temp_wav(parkinson_wav)
            tmp_paths.append(p)
            feats = extract_all_acoustic_features(p)
            results["parkinson"] = parkinson.predict_parkinson(feats)

        dementia_files = {"CTD": dementia_CTD, "PFT": dementia_PFT, "SFT": dementia_SFT}
        dementia_files = {k: v for k, v in dementia_files.items() if v is not None}
        if dementia_files:
            wav_paths_by_task = {}
            raw_features_by_task = {}
            for task, upload in dementia_files.items():
                p = await _save_temp_wav(upload)
                tmp_paths.append(p)
                wav_paths_by_task[task] = p
                raw_features_by_task[task] = extract_all_acoustic_features(p)
            results["dementia"] = dementia.predict_dementia(wav_paths_by_task, raw_features_by_task)

        if not results:
            raise HTTPException(status_code=400, detail="최소 1개 이상의 WAV가 필요합니다.")

        return results
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"통합 예측 중 오류: {str(e)}")
    finally:
        _cleanup_temp_files(*tmp_paths)  # ZDR
