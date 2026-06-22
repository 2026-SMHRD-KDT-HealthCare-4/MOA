"""
HuBERT 임베딩 추출 모듈
facebook/hubert-base-ls960 모델을 서버 시작 시 1회만 로드해서
치매(및 추후 우울증/ALS) 파이프라인에서 공용으로 사용한다.
"""
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import torch
import librosa
from transformers import HubertModel, Wav2Vec2FeatureExtractor

_HUBERT_MODEL_NAME = "facebook/hubert-base-ls960"
_device = "cuda" if torch.cuda.is_available() else "cpu"

_hubert_extractor = None
_hubert_model = None


def load_hubert():
    """서버 시작 시(main.py의 lifespan/startup)에서 한 번만 호출"""
    global _hubert_extractor, _hubert_model
    if _hubert_model is None:
        print(f"⏳ HuBERT 모델 로드 중... (device={_device})")
        _hubert_extractor = Wav2Vec2FeatureExtractor.from_pretrained(_HUBERT_MODEL_NAME)
        _hubert_model = HubertModel.from_pretrained(_HUBERT_MODEL_NAME).to(_device)
        _hubert_model.eval()
        print("✅ HuBERT 로드 완료")
    return _hubert_model


def extract_hubert_embedding(wav_path: str, max_seconds: int = 15) -> dict:
    """WAV 파일 → 768차원 HuBERT 임베딩(시간축 평균)"""
    if _hubert_model is None:
        load_hubert()
    try:
        y, sr = librosa.load(wav_path, sr=16000)
        max_len = max_seconds * sr
        if len(y) > max_len:
            y = y[:max_len]

        inputs = _hubert_extractor(y, sampling_rate=16000, return_tensors="pt")
        input_values = inputs["input_values"].to(_device)

        with torch.no_grad():
            outputs = _hubert_model(input_values)
            hidden_states = outputs.last_hidden_state
            embedding = hidden_states.mean(dim=1).squeeze().cpu().numpy()

        return {f"hubert_{i}": float(v) for i, v in enumerate(embedding)}
    except Exception:
        return {f"hubert_{i}": np.nan for i in range(768)}
