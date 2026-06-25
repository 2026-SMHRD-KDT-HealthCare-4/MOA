"""
BYOL-S 임베딩 추출 모듈 (당뇨 파이프라인 전용)
체크포인트: cvt_s1-d1-e64_s2-d1-e256_s3-d1-e512_BYOLAs64x96-
            osandbyolaloss6373-e100-bs256-lr0003-rs42.pth
모든 BYOL-S 계열 모델은 16kHz 샘플링을 전제로 사전학습되었으므로
입력 WAV는 반드시 16kHz로 리샘플링한다.
"""
import os
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import torch
try:
    import torchaudio
    if hasattr(torchaudio, "set_audio_backend"):
        torchaudio.set_audio_backend("soundfile")
except Exception:
    pass
import librosa

_byols_model = None

_DEFAULT_CHECKPOINT = os.environ.get(
    "BYOLS_CHECKPOINT_PATH",
    "checkpoints/cvt_s1-d1-e64_s2-d1-e256_s3-d1-e512_BYOLAs64x96-"
    "osandbyolaloss6373-e100-bs256-lr0003-rs42.pth",
)
_MODEL_NAME  = "cvt"
_CONFIG_PATH = "serab-byols/serab_byols/config.yaml"


def load_byols_model(checkpoint_path: str = None):
    """서버 시작 시 1회 호출 — main.py의 lifespan에서 로드"""
    global _byols_model
    if _byols_model is None:
        import serab_byols
        ckpt = checkpoint_path or _DEFAULT_CHECKPOINT
        print(f"⏳ BYOL-S/CvT 모델 로드 중... ({ckpt})")
        _byols_model = serab_byols.load_model(ckpt, _MODEL_NAME, _CONFIG_PATH)
        print("✅ BYOL-S/CvT 로드 완료 (2048차원 임베딩)")
    return _byols_model


def extract_byols_embedding(wav_path: str) -> np.ndarray:
    """
    WAV 파일 → 2048차원 BYOL-S/CvT 임베딩
    실패 시 None 반환
    """
    import serab_byols

    if _byols_model is None:
        load_byols_model()

    try:
        y, _ = librosa.load(wav_path, sr=16000)
        audio_tensor = torch.tensor(y, dtype=torch.float32).unsqueeze(0)  # (1, T)

        with torch.no_grad():
            embedding = serab_byols.get_scene_embeddings(audio_tensor, _byols_model)

        return embedding.squeeze().cpu().numpy()  # (2048,)
    except Exception as e:
        print(f"⚠️ BYOL-S 임베딩 추출 실패: {e}")
        return None