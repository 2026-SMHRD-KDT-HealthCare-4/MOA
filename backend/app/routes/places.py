"""장소 검색 프록시 — 카카오 로컬 API 키를 클라이언트에 노출하지 않기 위한 백엔드 프록시.

현재 제공: 노인 돌봄센터 키워드 검색(GET /places/care-centers).
- 카카오 키워드 검색(/v2/local/search/keyword.json)을 여러 돌봄 키워드로 병렬 호출 후 병합한다.
- category_name 에 '사회복지' 가 포함된 항목만 남긴다(키워드 오검색 제거).
- place id(또는 위경도) 기준으로 중복을 제거하고 거리순으로 정렬한다.
- 카카오 에러/타임아웃 시 예외를 내지 않고 빈 배열 + 에러 코드를 반환한다(프론트 빈 상태 처리).

응답 항목은 /hospital/search-nearby 와 동일한 필드(name·address·distance·phone·url 등)를
사용해 프론트에서 같은 장소 타입을 재사용할 수 있게 한다(여기에 lat·lng 추가 노출).
"""

import asyncio
import os

import httpx
from fastapi import APIRouter, Query
from pydantic import BaseModel

KAKAO_REST_KEY = os.getenv("KAKAO_REST_KEY", "c19535cd0cd962a7ddbc759cec982d36")
KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"

# 노인 돌봄센터 키워드 — 카카오 키워드 검색에 병렬 질의 후 병합한다.
CARE_CENTER_KEYWORDS = ["재가복지센터", "주야간보호센터", "노인복지관", "노인요양센터"]
# 키워드 오검색을 거르기 위한 카테고리 필터 토큰(예: "사회,공공기관 > 사회복지시설 > ...").
SOCIAL_WELFARE_TOKEN = "사회복지"

router = APIRouter(prefix="/places", tags=["places"])


class Place(BaseModel):
    id: str | None = None
    name: str
    address: str
    lat: float | None = None
    lng: float | None = None
    distance: str | None = None
    phone: str | None = None
    url: str | None = None


class CareCentersResponse(BaseModel):
    items: list[Place]
    # 정상(0건 포함) 시 None. 카카오 통신 실패 시 코드 문자열.
    error: str | None = None


async def _search_keyword(
    client: httpx.AsyncClient, keyword: str, lat: float, lng: float, radius: int
) -> list[dict]:
    params = {
        "query": keyword,
        "x": str(lng),
        "y": str(lat),
        "radius": str(radius),
        "sort": "distance",
    }
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_KEY}"}
    res = await client.get(KAKAO_KEYWORD_URL, headers=headers, params=params, timeout=10)
    res.raise_for_status()
    return res.json().get("documents", [])


@router.get("/care-centers", response_model=CareCentersResponse)
async def search_care_centers(
    lat: float = Query(..., description="위도"),
    lng: float = Query(..., description="경도"),
    radius: int = Query(2000, description="반경(m)"),
):
    """위경도 기준 주변 노인 돌봄센터를 검색한다 (카카오 키워드 검색 프록시).

    여러 키워드 병렬 질의 → category_name 에 '사회복지' 포함만 필터 → 중복 제거 → 거리순 정렬.
    카카오 에러/타임아웃 시 빈 배열 + 에러 코드를 반환한다(예외를 던지지 않음).
    """
    try:
        async with httpx.AsyncClient() as client:
            results = await asyncio.gather(
                *[_search_keyword(client, kw, lat, lng, radius) for kw in CARE_CENTER_KEYWORDS]
            )
    except httpx.TimeoutException:
        return CareCentersResponse(items=[], error="KAKAO_TIMEOUT")
    except Exception:
        return CareCentersResponse(items=[], error="KAKAO_ERROR")

    merged: dict[str, Place] = {}
    for docs in results:
        for doc in docs:
            category = doc.get("category_name") or ""
            if SOCIAL_WELFARE_TOKEN not in category:
                continue
            # 중복 제거: place id 우선, 없으면 위경도 조합으로 식별.
            place_id = doc.get("id") or f"{doc.get('x')},{doc.get('y')}"
            if place_id in merged:
                continue
            x, y = doc.get("x"), doc.get("y")
            merged[place_id] = Place(
                id=doc.get("id"),
                name=doc.get("place_name") or "",
                address=doc.get("road_address_name") or doc.get("address_name") or "",
                lat=float(y) if y else None,
                lng=float(x) if x else None,
                distance=doc.get("distance"),
                phone=doc.get("phone") or None,
                url=doc.get("place_url") or None,
            )

    items = sorted(
        merged.values(),
        key=lambda p: int(p.distance) if p.distance and p.distance.isdigit() else 10**9,
    )
    return CareCentersResponse(items=items, error=None)
