"""
공통 음향지표 추출 모듈
파킨슨/치매/당뇨 파이프라인에서 사용한 함수와 동일한 로직.
Parselmouth(Jitter/Shimmer/HNR/F0/포먼트) + Librosa(MFCC 등) + openSMILE(eGeMAPS)
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
        dur = call(sound, "Get total duration")

        pp = call(sound, "To PointProcess (periodic, cc)", 75, 500)
        jitter_local = call(pp, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
        jitter_abs = call(pp, "Get jitter (local, absolute)", 0, 0, 0.0001, 0.02, 1.3)
        jitter_rap = call(pp, "Get jitter (rap)", 0, 0, 0.0001, 0.02, 1.3)
        jitter_ppq5 = call(pp, "Get jitter (ppq5)", 0, 0, 0.0001, 0.02, 1.3)
        jitter_ddp = call(pp, "Get jitter (ddp)", 0, 0, 0.0001, 0.02, 1.3)
        shimmer_local = call([sound, pp], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
        shimmer_db = call([sound, pp], "Get shimmer (local_dB)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
        shimmer_apq3 = call([sound, pp], "Get shimmer (apq3)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
        shimmer_apq5 = call([sound, pp], "Get shimmer (apq5)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
        shimmer_apq11 = call([sound, pp], "Get shimmer (apq11)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
        shimmer_dda = call([sound, pp], "Get shimmer (dda)", 0, 0, 0.0001, 0.02, 1.3, 1.6)

        harmonicity = call(sound, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
        hnr = call(harmonicity, "Get mean", 0, 0)
        nhr = 1.0 / hnr if (hnr and hnr > 0) else np.nan

        pitch = call(sound, "To Pitch", 0, 75, 500)
        f0_mean = call(pitch, "Get mean", 0, 0, "Hertz")
        f0_std = call(pitch, "Get standard deviation", 0, 0, "Hertz")
        f0_min = call(pitch, "Get minimum", 0, 0, "Hertz", "Parabolic")
        f0_max = call(pitch, "Get maximum", 0, 0, "Hertz", "Parabolic")

        formant = call(sound, "To Formant (burg)", 0, 5, 5500, 0.025, 50)
        mid = dur / 2
        f1 = call(formant, "Get value at time", 1, mid, "Hertz", "Linear")
        f2 = call(formant, "Get value at time", 2, mid, "Hertz", "Linear")
        f3 = call(formant, "Get value at time", 3, mid, "Hertz", "Linear")

        vsa = abs(f1 * f2) / 1e6 if (f1 and f2 and not np.isnan(f1) and not np.isnan(f2)) else np.nan
        mpt = dur

        return {
            "Jitter(%)": jitter_local, "Jitter(Abs)": jitter_abs, "Jitter:RAP": jitter_rap,
            "Jitter:PPQ5": jitter_ppq5, "Jitter:DDP": jitter_ddp,
            "Shimmer": shimmer_local, "Shimmer(dB)": shimmer_db, "Shimmer:APQ3": shimmer_apq3,
            "Shimmer:APQ5": shimmer_apq5, "Shimmer:APQ11": shimmer_apq11, "Shimmer:DDA": shimmer_dda,
            "HNR": hnr, "NHR": nhr,
            "f0_mean": f0_mean, "f0_std": f0_std, "f0_min": f0_min, "f0_max": f0_max,
            "F1": f1, "F2": f2, "F3": f3, "VSA": vsa, "MPT": mpt,
        }
    except Exception:
        keys = ["Jitter(%)", "Jitter(Abs)", "Jitter:RAP", "Jitter:PPQ5", "Jitter:DDP",
                "Shimmer", "Shimmer(dB)", "Shimmer:APQ3", "Shimmer:APQ5", "Shimmer:APQ11", "Shimmer:DDA",
                "HNR", "NHR", "f0_mean", "f0_std", "f0_min", "f0_max", "F1", "F2", "F3", "VSA", "MPT"]
        return {k: np.nan for k in keys}


def extract_librosa_features(wav_path: str) -> dict:
    try:
        y, sr = librosa.load(wav_path, sr=16000)

        rms = float(np.mean(librosa.feature.rms(y=y)))
        sc = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        sb = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))
        sr_ = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))

        S = np.abs(librosa.stft(y))
        freqs = librosa.fft_frequencies(sr=sr)
        low = np.mean(S[freqs < 1000, :])
        high = np.mean(S[freqs >= 1000, :])
        alpha_ratio = low / high if high > 0 else np.nan

        rms_frame = librosa.feature.rms(y=y)[0]
        threshold = np.mean(rms_frame) * 0.5
        voiced_frames = np.sum(rms_frame > threshold)
        speech_rate = voiced_frames / (len(y) / sr) if len(y) > 0 else np.nan
        pause_ratio = 1.0 - (voiced_frames / len(rms_frame)) if len(rms_frame) > 0 else np.nan

        feats = {
            "RMS": rms, "spectral_centroid": sc, "spectral_bandwidth": sb,
            "spectral_rolloff": sr_, "ZCR": zcr, "alpha_ratio": alpha_ratio,
            "speech_rate": speech_rate, "pause_ratio": pause_ratio,
        }

        # MFCC 평균 + 표준편차 + 델타 (파킨슨 v4 정교화 반영)
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        delta_mfccs = librosa.feature.delta(mfccs)
        for i, (coef, delta) in enumerate(zip(mfccs, delta_mfccs), start=1):
            feats[f"mfcc_{i}"] = float(np.mean(coef))
            feats[f"mfcc_{i}_std"] = float(np.std(coef))
            feats[f"mfcc_{i}_delta"] = float(np.mean(delta))

        return feats
    except Exception:
        keys = (["RMS", "spectral_centroid", "spectral_bandwidth", "spectral_rolloff",
                  "ZCR", "alpha_ratio", "speech_rate", "pause_ratio"]
                + [f"mfcc_{i}" for i in range(1, 14)]
                + [f"mfcc_{i}_std" for i in range(1, 14)]
                + [f"mfcc_{i}_delta" for i in range(1, 14)])
        return {k: np.nan for k in keys}


def extract_opensmile_features(wav_path: str) -> dict:
    try:
        feat_df = _smile.process_file(wav_path)
        feat_dict = feat_df.iloc[0].to_dict()
        return {f"os_{k}": v for k, v in feat_dict.items()}
    except Exception:
        return {}


def extract_all_acoustic_features(wav_path: str) -> dict:
    """파킨슨/치매/당뇨 공통: 음향지표 전체(Parselmouth+Librosa+openSMILE) 추출"""
    feats = {}
    feats.update(extract_parselmouth_features(wav_path))
    feats.update(extract_librosa_features(wav_path))
    feats.update(extract_opensmile_features(wav_path))
    return feats
