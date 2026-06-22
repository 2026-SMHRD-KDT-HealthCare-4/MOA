from supabase import create_client, Client
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# 일반 클라이언트 — anon key, 프론트에서 넘어온 사용자 JWT 검증 등 일반 API 용
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 관리자 클라이언트 — service_role key, admin API 전용 (generate_link 등)
# 이 객체는 반드시 백엔드 내부에서만 사용. 프론트로 키나 토큰을 노출 금지.
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
