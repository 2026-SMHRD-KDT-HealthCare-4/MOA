"""
음성 특징점 추출 서비스
- parselmouth(Praat): f0, jitter, shimmer, hnr, nhr 등 음성 병리 지표
- librosa: spectral_centroid, speech_rate 등
- opensmile: alpha_ratio 등 보조 지표

⚠️ ZDR 원칙: 이 모듈은 메모리상의 음성 데이터만 받아 처리하며,
   음성 원본을 디스크에 저장하지 않는다. 호출부(analyze.py)에서
   처리 직후 음성 데이터를 폐기한다.
"""

import numpy as np
import tempfile
import os


def extract_features(audio_bytes: bytes) -> dict:
    """
    음성 바이트 데이터를 받아 15개 특징점을 추출한다.
    임시 파일은 처리 직후 반드시 삭제한다 (ZDR).
    """
    tmp_path = None
    try:
        # parselmouth/librosa는 파일 경로를 요구하므로
        # 임시 파일을 만들되, finally에서 즉시 삭제 (디스크 잔존 X)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        features = {}
        features.update(_extract_praat_features(tmp_path))
        features.update(_extract_librosa_features(tmp_path))
        features.update(_extract_opensmile_features(tmp_path))

        return features

    finally:
        # ZDR: 임시 음성 파일 즉시 삭제
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


def _extract_praat_features(path: str) -> dict:
    """parselmouth(Praat)로 음성 병리 지표 추출"""
    import parselmouth
    from parselmouth.praat import call

    sound = parselmouth.Sound(path)
    pitch = sound.to_pitch()

    # F0 (기본 주파수)
    f0_values = pitch.selected_array["frequency"]
    f0_voiced = f0_values[f0_values > 0]  # 무성 구간 제외
    f0_mean = float(np.mean(f0_voiced)) if len(f0_voiced) > 0 else 0.0
    f0_std = float(np.std(f0_voiced)) if len(f0_voiced) > 0 else 0.0

    # PointProcess (jitter/shimmer 계산용)
    point_process = call(sound, "To PointProcess (periodic, cc)", 75, 500)

    # Jitter
    jitter_rap = call(point_process, "Get jitter (rap)", 0, 0, 0.0001, 0.02, 1.3)

    # Shimmer
    shimmer_local = call([sound, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    shimmer_apq3 = call([sound, point_process], "Get shimmer (apq3)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    shimmer_apq11 = call([sound, point_process], "Get shimmer (apq11)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    shimmer_apq = call([sound, point_process], "Get shimmer (apq5)", 0, 0, 0.0001, 0.02, 1.3, 1.6)

    # HNR / NHR
    harmonicity = sound.to_harmonicity()
    hnr = call(harmonicity, "Get mean", 0, 0)
    nhr = (1.0 / hnr) if hnr and hnr != 0 else 0.0

    # MPT (최대 발성 시간) - 유성 구간 길이로 근사
    mpt = float(len(f0_voiced) * pitch.time_step) if len(f0_voiced) > 0 else 0.0

    def safe(v):
        try:
            f = float(v)
            return 0.0 if (np.isnan(f) or np.isinf(f)) else f
        except (TypeError, ValueError):
            return 0.0

    return {
        "f0_mean": safe(f0_mean),
        "f0_std": safe(f0_std),
        "jitter_rap": safe(jitter_rap),
        "shimmer_local": safe(shimmer_local),
        "shimmer_apq3": safe(shimmer_apq3),
        "shimmer_apq11": safe(shimmer_apq11),
        "shimmer_apq": safe(shimmer_apq),
        "hnr": safe(hnr),
        "nhr": safe(nhr),
        "mpt": safe(mpt),
    }


def _extract_librosa_features(path: str) -> dict:
    """librosa로 스펙트럼/발화 지표 추출"""
    import librosa

    y, sr = librosa.load(path, sr=None)

    # Spectral Centroid
    spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))

    # Pause ratio (무음 구간 비율)
    intervals = librosa.effects.split(y, top_db=30)  # 비무음 구간
    voiced_duration = sum((end - start) for start, end in intervals) / sr
    total_duration = len(y) / sr
    pause_ratio = float(1 - (voiced_duration / total_duration)) if total_duration > 0 else 0.0

    # Speech rate (초당 음절 근사: onset 개수 기반)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
    speech_rate = float(len(onsets) / total_duration) if total_duration > 0 else 0.0

    # VSA (모음 공간 면적) - 포먼트 기반 근사값 (간이 계산)
    # 정밀 측정은 parselmouth 포먼트 필요. 여기서는 0으로 두고 ML팀 협의 후 보완.
    vsa_area = 0.0

    def safe(v):
        f = float(v)
        return 0.0 if (np.isnan(f) or np.isinf(f)) else f

    return {
        "spectral_centroid": safe(spectral_centroid),
        "pause_ratio": safe(pause_ratio),
        "speech_rate": safe(speech_rate),
        "vsa_area": safe(vsa_area),
    }


def _extract_opensmile_features(path: str) -> dict:
    """opensmile로 alpha_ratio 등 보조 지표 추출"""
    try:
        import opensmile

        smile = opensmile.Smile(
            feature_set=opensmile.FeatureSet.eGeMAPSv02,
            feature_level=opensmile.FeatureLevel.Functionals,
        )
        result = smile.process_file(path)

        # eGeMAPS에 alphaRatio 관련 지표 포함
        alpha_ratio = 0.0
        for col in result.columns:
            if "alphaRatio" in col:
                alpha_ratio = float(result[col].values[0])
                break

        f = float(alpha_ratio)
        return {"alpha_ratio": 0.0 if (np.isnan(f) or np.isinf(f)) else f}

    except Exception:
        # opensmile 미설치/오류 시 기본값
        return {"alpha_ratio": 0.0}
