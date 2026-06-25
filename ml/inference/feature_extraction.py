"""
공통 음향지표 추출 모듈
위치: MOA/MOA/ml/inference/feature_extraction.py

파킨슨: extract_all_acoustic_features() 결과(157개 전체)를 그대로 넘겨야 함
        selector(SelectKBest)가 157 → 22개로 줄여줌
치매:   extract_dementia_features() 결과를 acoustic_cols 순서대로 넘겨야 함
"""
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import parselmouth
from parselmouth.praat import call
import librosa
import opensmile

_smile = opensmile.Smile(
    feature_set=opensmile.FeatureSet.eGeMAPSv02,
    feature_level=opensmile.FeatureLevel.Functionals,
)


def extract_parselmouth_features(wav_path: str) -> dict:
    try:
        sound = parselmouth.Sound(wav_path)
        dur   = call(sound, "Get total duration")

        pp = call(sound, "To PointProcess (periodic, cc)", 75, 500)

        jitter_local  = call(pp, "Get jitter (local)",           0, 0, 0.0001, 0.02, 1.3)
        jitter_abs    = call(pp, "Get jitter (local, absolute)", 0, 0, 0.0001, 0.02, 1.3)
        jitter_rap    = call(pp, "Get jitter (rap)",             0, 0, 0.0001, 0.02, 1.3)
        jitter_ppq5   = call(pp, "Get jitter (ppq5)",            0, 0, 0.0001, 0.02, 1.3)
        jitter_ddp    = call(pp, "Get jitter (ddp)",             0, 0, 0.0001, 0.02, 1.3)

        shimmer_local  = call([sound, pp], "Get shimmer (local)",    0, 0, 0.0001, 0.02, 1.3, 1.6)
        shimmer_db     = call([sound, pp], "Get shimmer (local_dB)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
        shimmer_apq3   = call([sound, pp], "Get shimmer (apq3)",     0, 0, 0.0001, 0.02, 1.3, 1.6)
        shimmer_apq5   = call([sound, pp], "Get shimmer (apq5)",     0, 0, 0.0001, 0.02, 1.3, 1.6)
        shimmer_apq11  = call([sound, pp], "Get shimmer (apq11)",    0, 0, 0.0001, 0.02, 1.3, 1.6)
        shimmer_dda    = call([sound, pp], "Get shimmer (dda)",      0, 0, 0.0001, 0.02, 1.3, 1.6)

        harmonicity = call(sound, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
        hnr = call(harmonicity, "Get mean", 0, 0)
        nhr = 1.0 / hnr if (hnr and hnr > 0) else np.nan

        pitch   = call(sound, "To Pitch", 0, 75, 500)
        f0_mean = call(pitch, "Get mean",               0, 0, "Hertz")
        f0_std  = call(pitch, "Get standard deviation", 0, 0, "Hertz")
        f0_min  = call(pitch, "Get minimum",            0, 0, "Hertz", "Parabolic")
        f0_max  = call(pitch, "Get maximum",            0, 0, "Hertz", "Parabolic")
        f0_range = (f0_max - f0_min) if (
            f0_max and f0_min and not np.isnan(f0_max) and not np.isnan(f0_min)
        ) else np.nan

        # F0 flatness / velocity (치매 특화 운율 지표)
        voiced_f0 = []
        n_frames  = call(pitch, "Get number of frames")
        for i in range(1, int(n_frames) + 1):
            v = call(pitch, "Get value in frame", i, "Hertz")
            if v and not np.isnan(v):
                voiced_f0.append(v)
        if len(voiced_f0) > 1:
            arr              = np.array(voiced_f0)
            f0_flatness      = float(np.std(arr) / np.mean(arr)) if np.mean(arr) > 0 else np.nan
            f0_velocity_mean = float(np.mean(np.abs(np.diff(arr))))
        else:
            f0_flatness      = np.nan
            f0_velocity_mean = np.nan

        formant = call(sound, "To Formant (burg)", 0, 5, 5500, 0.025, 50)
        mid = dur / 2
        f1  = call(formant, "Get value at time", 1, mid, "Hertz", "Linear")
        f2  = call(formant, "Get value at time", 2, mid, "Hertz", "Linear")
        f3  = call(formant, "Get value at time", 3, mid, "Hertz", "Linear")

        return {
            "duration":         dur,
            "f0_mean":          f0_mean,
            "f0_std":           f0_std,
            "f0_range":         f0_range,
            "f0_flatness":      f0_flatness,
            "f0_velocity_mean": f0_velocity_mean,
            "jitter_local":     jitter_local,
            "jitter_rap":       jitter_rap,
            "shimmer_local":    shimmer_local,
            "shimmer_db":       shimmer_db,
            "HNR":              hnr,
            "F1":               f1,
            "F2":               f2,
            "F3":               f3,
            "f0_min":           f0_min,
            "f0_max":           f0_max,
            "MPT":              dur,        # 파킨슨 feature_names 기준 대문자
            "jitter_abs":       jitter_abs,
            "jitter_ppq5":      jitter_ppq5,
            "jitter_ddp":       jitter_ddp,
            "shimmer_apq3":     shimmer_apq3,
            "shimmer_apq5":     shimmer_apq5,
            "shimmer_apq11":    shimmer_apq11,
            "shimmer_dda":      shimmer_dda,
            "nhr":              nhr,
        }

    except Exception as e:
        print(f"⚠️ parselmouth 추출 실패: {e}")
        return {k: np.nan for k in [
            "duration", "f0_mean", "f0_std", "f0_range", "f0_flatness", "f0_velocity_mean",
            "jitter_local", "jitter_rap", "shimmer_local", "shimmer_db", "HNR", "F1", "F2", "F3",
            "f0_min", "f0_max", "MPT",          # ← 대문자 통일
            "jitter_abs", "jitter_ppq5", "jitter_ddp",
            "shimmer_apq3", "shimmer_apq5", "shimmer_apq11", "shimmer_dda", "nhr",
        ]}


def extract_librosa_features(wav_path: str) -> dict:
    try:
        y, sr    = librosa.load(wav_path, sr=16000)
        rms_feat = librosa.feature.rms(y=y)
        rms      = float(np.mean(rms_feat))
        sc       = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        sb       = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))
        srolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
        zcr      = float(np.mean(librosa.feature.zero_crossing_rate(y)))

        S     = np.abs(librosa.stft(y))
        freqs = librosa.fft_frequencies(sr=sr)
        low   = np.mean(S[freqs < 1000, :])
        high  = np.mean(S[freqs >= 1000, :])
        alpha_ratio = float(low / high) if high > 0 else np.nan

        rms_frame     = rms_feat[0]
        threshold     = np.mean(rms_frame) * 0.5
        voiced_frames = np.sum(rms_frame > threshold)
        total_frames  = len(rms_frame)
        speech_rate   = float(voiced_frames / (len(y) / sr)) if len(y) > 0 else np.nan
        pause_ratio   = float(1.0 - voiced_frames / total_frames) if total_frames > 0 else np.nan

        # pause 세부 분석
        silence_mask = rms_frame <= threshold
        transitions  = np.diff(silence_mask.astype(int))
        pause_starts = np.where(transitions == 1)[0]
        pause_ends   = np.where(transitions == -1)[0]
        if len(pause_starts) > 0 and len(pause_ends) > 0:
            if pause_ends[0] < pause_starts[0]:
                pause_ends = pause_ends[1:]
            n           = min(len(pause_starts), len(pause_ends))
            pause_durs  = (pause_ends[:n] - pause_starts[:n]) / (sr / 512)
            pause_count = int(n)
            max_pause   = float(np.max(pause_durs)) if n > 0 else 0.0
        else:
            pause_count = 0
            max_pause   = 0.0

        feats = {
            "RMS":                     rms,
            "spectral_centroid":       sc,
            "spectral_bandwidth":      sb,
            "spectral_rolloff":        srolloff,
            "ZCR":                     zcr,
            "alpha_ratio":             alpha_ratio,
            "speech_rate":             speech_rate,
            "pause_ratio":             pause_ratio,
            "pause_count":             pause_count,
            "max_pause_sec":           max_pause,
            "word_pause_count":        pause_count,
            "word_pause_mean_sec":     max_pause / max(pause_count, 1),
            "sentence_pause_count":    max(pause_count // 3, 0),
            "sentence_pause_mean_sec": max_pause,
        }

        mfccs       = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        delta_mfccs = librosa.feature.delta(mfccs)
        for i, (coef, delta) in enumerate(zip(mfccs, delta_mfccs), start=1):
            feats[f"mfcc_{i}"]       = float(np.mean(coef))
            feats[f"mfcc_{i}_std"]   = float(np.std(coef))
            feats[f"mfcc_{i}_delta"] = float(np.mean(delta))

        return feats

    except Exception as e:
        print(f"⚠️ librosa 추출 실패: {e}")
        keys = (
            ["RMS", "spectral_centroid", "spectral_bandwidth", "spectral_rolloff",
             "ZCR", "alpha_ratio", "speech_rate", "pause_ratio",
             "pause_count", "max_pause_sec", "word_pause_count", "word_pause_mean_sec",
             "sentence_pause_count", "sentence_pause_mean_sec"]
            + [f"mfcc_{i}"       for i in range(1, 14)]
            + [f"mfcc_{i}_std"   for i in range(1, 14)]
            + [f"mfcc_{i}_delta" for i in range(1, 14)]
        )
        return {k: np.nan for k in keys}


def extract_opensmile_features(wav_path: str) -> dict:
    try:
        feat_df   = _smile.process_file(wav_path)
        feat_dict = feat_df.iloc[0].to_dict()
        return {f"os_{k}": v for k, v in feat_dict.items()}
    except Exception as e:
        print(f"⚠️ openSMILE 추출 실패: {e}")
        return {}


def extract_all_acoustic_features(wav_path: str) -> dict:
    """
    파킨슨 / 치매 공통 음향지표 전체 추출 (157개)
    파킨슨 추론 시 이 함수 결과를 그대로 features["acoustic"]에 넣어야 함
    selector가 내부에서 157 → 22개로 줄여줌
    """
    feats = {}
    feats.update(extract_parselmouth_features(wav_path))
    feats.update(extract_librosa_features(wav_path))
    feats.update(extract_opensmile_features(wav_path))
    return feats


def extract_dementia_features(wav_path: str, acoustic_cols: list) -> list:
    """
    치매 전용 — acoustic_cols.pkl 순서에 맞게 정렬된 리스트 반환
    언어 특징(ttr, filler_ratio 등)은 0.0으로 채움
    Whisper 기반 언어 특징 추출기 결과가 있으면 all_feats.update() 후 넘길 것
    """
    all_feats = extract_all_acoustic_features(wav_path)

    # 언어 특징 기본값
    lang_defaults = {
        "ttr":              0.0,
        "filler_ratio":     0.0,
        "total_words":      0.0,
        "content_density":  0.0,
        "ttr_per_min":      0.0,
        "repetition_ratio": 0.0,
    }
    all_feats.update(lang_defaults)

    # acoustic_cols 순서대로 리스트로 반환 (치매 모델 입력은 list)
    return [float(all_feats.get(k, 0.0)) for k in acoustic_cols]