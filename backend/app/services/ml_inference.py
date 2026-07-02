"""
ML 추론 bridge — 백엔드 ↔ MOAInferenceEngine 연결
"""

import os
import sys
import shutil
import subprocess
import tempfile
import numpy as np

_BACKEND_DIR      = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_PROJECT_ROOT     = os.path.dirname(_BACKEND_DIR)
_ML_DIR           = os.path.join(_PROJECT_ROOT, "ml")
_ML_INFERENCE_DIR = os.path.join(_ML_DIR, "inference")
_ML_MODELS_DIR    = os.path.join(_ML_DIR, "models")

if _ML_INFERENCE_DIR not in sys.path:
    sys.path.insert(0, _ML_INFERENCE_DIR)
if _ML_DIR not in sys.path:
    sys.path.append(_ML_DIR)

import feature_extraction as _fe
from total_engine import MOAInferenceEngine

# HuBERT 추출 모듈 (치매용)
try:
    import hubert_extraction as _he
    _HUBERT_OK = True
except ImportError:
    print("⚠️ hubert_extraction 임포트 실패 — 치매 HuBERT 비활성화")
    _HUBERT_OK = False

# BYOL-S 추출 모듈 (당뇨용)
try:
    import byols_extraction as _be
    _BYOLS_OK = True
except ImportError:
    print("⚠️ byols_extraction 임포트 실패 — 당뇨 추론 비활성화")
    _BYOLS_OK = False


# ── 엔진 싱글톤 ──────────────────────────────────────────────────
_engine = None

def _get_engine() -> MOAInferenceEngine:
    global _engine
    if _engine is None:
        engine = MOAInferenceEngine.__new__(MOAInferenceEngine)
        engine.ml_root = _ML_MODELS_DIR
        engine.models  = {
            "dementia":  {},
            "diabetes":  {"male": {}, "female": {}},
            "parkinson": {},
        }
        engine.load_all_models()
        _engine = engine
    return _engine


# ── 등급 변환 ────────────────────────────────────────────────────
def _score_to_level(score: float, disease: str = "") -> str:
    if disease == "parkinson":
        if score >= 0.85:
            return "AMBER"
        if score >= 0.60:
            return "YELLOW"
        return "GREEN"
    elif disease == "dementia":
        if score >= 0.70:
            return "AMBER"
        if score >= 0.45:
            return "YELLOW"
        return "GREEN"
    else:
        if score >= 0.7:
            return "AMBER"
        if score >= 0.4:
            return "YELLOW"
        return "GREEN"


# ── 메인 추론 함수 ───────────────────────────────────────────────
def _decode_to_wav(audio_bytes: bytes) -> str:
    """
    입력 오디오(webm/m4a/wav/ogg 등 무엇이든)를 표준 16kHz mono PCM WAV로
    디코딩해 임시파일 경로를 반환한다.

    웹 챗봇은 webm(Opus), 모바일은 m4a를 보내는데 parselmouth/openSMILE/
    BYOL-S 등은 진짜 PCM WAV만 읽을 수 있으므로 여기서 한 번 정규화해
    이후 모든 추출기(음향지표/HuBERT/BYOL-S)가 같은 WAV를 쓰게 한다.

    1순위: ffmpeg(설치돼 있으면) — 가장 폭넓은 포맷 지원
    2순위: librosa(audioread/soundfile) — ffmpeg 없을 때의 폴백
    호출부가 반환된 경로를 finally에서 삭제한다(ZDR).
    """
    raw_fd, raw_path = tempfile.mkstemp(suffix=".bin")
    os.close(raw_fd)
    with open(raw_path, "wb") as f:
        f.write(audio_bytes)

    wav_fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(wav_fd)

    try:
        ffmpeg = shutil.which("ffmpeg")
        if ffmpeg:
            proc = subprocess.run(
                [ffmpeg, "-y", "-i", raw_path,
                 "-ac", "1", "-ar", "16000", "-f", "wav", "-acodec", "pcm_s16le",
                 wav_path],
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            )
            if proc.returncode == 0 and os.path.getsize(wav_path) > 0:
                return wav_path
            err = proc.stderr.decode("utf-8", errors="replace")[-300:]
            print(f"⚠️ ffmpeg 변환 실패, librosa 폴백 시도: {err}")

        # 폴백: librosa로 디코딩 후 soundfile로 WAV 기록
        import librosa
        import soundfile as sf

        y, _ = librosa.load(raw_path, sr=16000, mono=True)
        sf.write(wav_path, y, 16000, subtype="PCM_16")
        return wav_path

    except Exception:
        if os.path.exists(wav_path):
            os.remove(wav_path)
        raise
    finally:
        if os.path.exists(raw_path):
            os.remove(raw_path)


def predict_risk_from_wav(audio_bytes: bytes, user_info: dict, sample_type: str = None) -> dict:
    tmp_path = None
    try:
        # 입력이 webm/m4a/wav 무엇이든 표준 16kHz PCM WAV로 변환한 뒤 처리한다.
        # 이렇게 한 번 정규화하면 아래의 음향지표/HuBERT/BYOL-S 추출이 모두
        # 동일한 정상 WAV를 사용하게 되어 "Not an audio file" 오류가 사라진다.
        tmp_path = _decode_to_wav(audio_bytes)

        # ── 1. 음향지표 추출 (파킨슨용) ──
        acoustic = _fe.extract_all_acoustic_features(tmp_path)

        # ── 2. 치매용 음향지표 — acoustic_cols 순서 보장 ──
        engine = _get_engine()
        dem_acoustic_cols = engine.models["dementia"].get("CTD", {}).get("acoustic_cols", [])

        if dem_acoustic_cols:
            dem_feat_list = _fe.extract_dementia_features(tmp_path, dem_acoustic_cols)
            raw_features  = {"CTD": dem_feat_list}
        else:
            print("⚠️ acoustic_cols 없음 — acoustic dict fallback")
            raw_features = {"CTD": acoustic}

        # ── 3. HuBERT 임베딩 추출 (치매용) ──
        hubert_embedding = None
        if _HUBERT_OK:
            try:
                hubert_dict = _he.extract_hubert_embedding(tmp_path)
                hubert_embedding = np.array(
                    [hubert_dict[f"hubert_{i}"] for i in range(len(hubert_dict))],
                    dtype=float
                )
                if np.isnan(hubert_embedding).any():
                    print("⚠️ HuBERT 임베딩에 NaN 포함 — 치매 HuBERT 비활성화")
                    hubert_embedding = None
            except Exception as e:
                print(f"⚠️ HuBERT 추출 실패: {e}")
                hubert_embedding = None

        # ── 4. BYOL-S 임베딩 추출 (당뇨용) ──
        byols_embedding = None
        if _BYOLS_OK:
            try:
                byols_embedding = _be.extract_byols_embedding(tmp_path)
            except Exception as e:
                print(f"⚠️ BYOL-S 추출 실패: {e}")
                byols_embedding = None

        # ── 디버그: 각 모델 입력이 실제로 들어왔는지 확인 ──
        # (None/비어있음이면 해당 질환이 0으로 떨어지는 원인이 된다)
        print(
            "🔎 ML 입력 점검 → "
            f"raw_features(치매)={'있음' if raw_features.get('CTD') else '없음'}, "
            f"hubert(치매)={'있음' if hubert_embedding is not None else 'None'}, "
            f"byols(당뇨)={'있음' if byols_embedding is not None else 'None'}, "
            f"user_info={user_info}"
        )

        # ── 5. features 딕셔너리 구성 ──
        features = {
            "acoustic":         acoustic,           # 파킨슨용
            "raw_features":     raw_features,       # 치매용 (acoustic_cols 순서 보장)
            "hubert_embedding": hubert_embedding,   # 치매 HuBERT 임베딩
            "byols_embedding":  byols_embedding,    # 당뇨 BYOL-S 임베딩
            "wav_path":         tmp_path,
        }

        result = engine.predict_all(features, user_info, sample_type=sample_type)

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

    rs  = result["data"]["risk_score"]
    pkn = float(rs["score_pkn"])
    dem = float(rs["score_dem"])
    dm  = float(rs["score_dm"])

    # ── 디버그: ML이 백엔드에 넘기는 최종 점수 ──
    # 이 값과 DB(risk_prediction)의 값을 비교하면 0이 어디서 생기는지 알 수 있다.
    #  - 여기서 이미 0 → ML 엔진(total_engine) 계산/입력 문제
    #  - 여기선 0이 아닌데 DB가 0 → 저장(컬럼/스키마) 문제
    print(f"🎯 ML 최종 점수 → pkn={pkn}, dem={dem}, dm={dm}")

    return {
        "parkinson":  {"score": pkn, "level": _score_to_level(pkn, "parkinson")},
        "dementia":   {"score": dem, "level": _score_to_level(dem, "dementia")},
        "diabetes":   {"score": dm,  "level": _score_to_level(dm,  "diabetes")},
    }
