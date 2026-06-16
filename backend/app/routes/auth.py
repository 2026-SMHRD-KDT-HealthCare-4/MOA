from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.supabase_client import supabase
from app.core.security import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str  # "elder" or "guardian"

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/register")
def register(req: RegisterRequest):
    try:
        # Supabase Auth로 회원가입
        res = supabase.auth.sign_up({
            "email": req.email,
            "password": req.password,
            "options": {
                "data": {
                    "name": req.name,
                    "role": req.role,
                }
            }
        })

        if res.user is None:
            raise HTTPException(status_code=400, detail="회원가입에 실패했습니다.")

        # users 테이블에도 역할/이름 저장
        supabase.table("users").insert({
            "id": res.user.id,
            "email": req.email,
            "name": req.name,
            "role": req.role,
        }).execute()

        return {"status": "success", "message": "회원가입 완료. 이메일 인증을 확인해주세요."}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
def login(req: LoginRequest):
    try:
        # Supabase Auth로 로그인
        res = supabase.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password,
        })

        if res.user is None:
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다.")

        user_id = res.user.id
        meta = res.user.user_metadata or {}
        role = meta.get("role", "elder")
        name = meta.get("name", "")

        # 자체 JWT 발급 (프론트엔드에서 사용)
        token = create_access_token({"sub": user_id, "role": role})

        return {
            "status": "success",
            "data": {
                "access_token": token,
                "token_type": "bearer",
                "role": role,
                "name": name,
            }
        }

    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/logout")
def logout():
    try:
        supabase.auth.sign_out()
        return {"status": "success", "message": "로그아웃 완료"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
