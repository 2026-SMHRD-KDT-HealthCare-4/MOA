"""
BYOL-S 임베딩 추출 모듈 (당뇨 파이프라인 전용)
serab-byols 패키지의 'default' 체크포인트를 사용해 WAV → 2048차원 임베딩 추출.

⚠️ 설치 필요 (requirements.txt에 추가됨):
    pip install torch torchaudio
    git clone https://github.com/GasserElbanna/serab-byols
    pip install -e serab-byols/   (또는 pip install serab-byols, 패키지명은 환경에 따라 확인 필요)

체크포인트 파일(.pth)은 레포 내 checkpoints/ 폴더에서 받아야 하며,
BYOLS_CHECKPOINT_PATH 환경변수 또는 아래 기본 경로에 위치시켜야 한다.
모든 BYOL-S 계열 모델은 16kHz 샘플링을 전제로 사전학습되었으므로,
입력 WAV는 반드시 16kHz로 리샘플링한다.
"""
import os
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import torch
try:
    import torchaudio
    try:
        if hasattr(torchaudio, "set_audio_backend"):
            torchaudio.set_audio_backend("soundfile")
    except Exception:
        pass  # 최신 torchaudio는 이 설정 불필요 (자동 백엔드 선택)
except Exception:
    pass
import librosa

_byols_model = None

_DEFAULT_CHECKPOINT = os.environ.get(
    "BYOLS_CHECKPOINT_PATH",
    "checkpoints/default2048_BYOLAs64x96-2105311814-e100-bs256-lr0003-rs42.pth",
)
_MODEL_NAME = "cvt"  # serab_byols 패키지 기준 'default' = 2048차원 출력


def load_byols_model(checkpoint_path: str = None):
    """서버 시작 시 1회 호출 — main.py의 lifespan에서 로드"""
    global _byols_model
    if _byols_model is None:
        import serab_byols  # 지연 import: 패키지 미설치 시에도 서버 자체는 뜨도록

        ckpt = checkpoint_path or _DEFAULT_CHECKPOINT
        if not os.path.exists(ckpt):
            raise FileNotFoundError(
                f"BYOL-S 체크포인트를 찾을 수 없습니다: {ckpt}\n"
                f"https://github.com/GasserElbanna/serab-byols 의 checkpoints/ 폴더에서 "
                f"'default2048_*.pth' 파일을 받아 해당 경로에 두거나 "
                f"BYOLS_CHECKPOINT_PATH 환경변수로 경로를 지정하세요."
            )
        print(f"⏳ BYOL-S 모델 로드 중... ({ckpt})")
        try:
            _byols_model = serab_byols.load_model(ckpt, _MODEL_NAME)
        except Exception as e:
            import traceback
            print("❌ BYOL-S 로딩 에러 전체:")
            traceback.print_exc()
            raise
        print("✅ BYOL-S 로드 완료 (2048차원 임베딩)")
    return _byols_model


def extract_byols_embedding(wav_path: str) -> np.ndarray:
    """
    WAV 파일 → 2048차원 BYOL-S 임베딩(scene embedding, 발화 전체 평균)
    실패 시 None 반환 (호출 측에서 에러 처리)
    """
    import serab_byols

    if _byols_model is None:
        load_byols_model()

    try:
        y, sr = librosa.load(wav_path, sr=16000)  # BYOL-S는 16kHz 고정 전제
        audio_tensor = torch.tensor(y, dtype=torch.float32).unsqueeze(0)  # (1, samples)

        with torch.no_grad():
            embedding = serab_byols.get_scene_embeddings(audio_tensor, _byols_model)

        return embedding.squeeze().cpu().numpy()  # (2048,)
    except Exception as e:
        print(f"⚠️  BYOL-S 임베딩 추출 실패: {e}")
        return None
