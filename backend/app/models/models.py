from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
import enum

class UserRole(str, enum.Enum):
    elder = "elder"
    guardian = "guardian"

class HealthStatus(str, enum.Enum):
    NORMAL = "NORMAL"
    CAUTION = "CAUTION"
    ALERT = "ALERT"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    records = relationship("VoiceRecord", back_populates="user")
    chat_logs = relationship("ChatLog", back_populates="user")

class VoiceRecord(Base):
    __tablename__ = "voice_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    transcript = Column(String, nullable=True)

    # 음성 특징점
    f0_mean = Column(Float, nullable=True)
    f0_std = Column(Float, nullable=True)
    jitter_rap = Column(Float, nullable=True)
    shimmer_apq = Column(Float, nullable=True)
    shimmer_local = Column(Float, nullable=True)
    shimmer_apq3 = Column(Float, nullable=True)
    shimmer_apq11 = Column(Float, nullable=True)
    hnr = Column(Float, nullable=True)
    nhr = Column(Float, nullable=True)
    mpt = Column(Float, nullable=True)
    vsa_area = Column(Float, nullable=True)
    pause_ratio = Column(Float, nullable=True)
    speech_rate = Column(Float, nullable=True)
    alpha_ratio = Column(Float, nullable=True)
    spectral_centroid = Column(Float, nullable=True)

    score = Column(Float, nullable=True)
    status = Column(Enum(HealthStatus), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="records")

class ChatLog(Base):
    __tablename__ = "chat_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)
    message = Column(String, nullable=False)
    emotion = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="chat_logs")
