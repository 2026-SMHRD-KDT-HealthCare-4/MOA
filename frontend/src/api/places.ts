// 장소 검색 API — 카카오는 프론트에서 직접 호출하지 않고 백엔드 프록시(/places, /hospital/geocode)만 호출.
// mock-first: EXPO_PUBLIC_AUTH_API_MODE 가 "real" 일 때만 백엔드 호출, 그 외에는 더미 데이터.
import { getToken } from "./session";

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);
const IS_REAL = process.env.EXPO_PUBLIC_AUTH_API_MODE === "real";

// /places/care-centers 및 /hospital/search-nearby 와 동일한 장소 형태(타입 재사용).
export interface Place {
  id?: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  distance?: string; // 카카오 원본 미터 문자열. 표시 포맷은 화면에서 처리.
  phone?: string;
  url?: string;
}

export interface CareCentersResult {
  items: Place[];
  error: string | null; // null=정상(0건 포함). 그 외=통신 실패 코드.
}

export type Coords = { lat: number; lng: number };

// mock 모드에서 보여줄 더미 돌봄센터 2~3건.
const MOCK_CARE_CENTERS: Place[] = [
  { id: "mock-1", name: "햇살재가복지센터", address: "광주 서구 상무대로 123", distance: "420", phone: "062-000-0001", lat: 35.152, lng: 126.852 },
  { id: "mock-2", name: "어울림주야간보호센터", address: "광주 서구 운천로 45", distance: "880", phone: "062-000-0002", lat: 35.149, lng: 126.857 },
  { id: "mock-3", name: "한마음노인복지관", address: "광주 서구 계수로 51", distance: "1240", phone: "062-000-0003", lat: 35.160, lng: 126.856 },
];

// 주소 → 좌표 (백엔드 카카오 지오코딩 프록시 재사용). real 모드 전용.
export async function geocodeAddress(address: string): Promise<Coords | null> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}/hospital/geocode?address=${encodeURIComponent(address)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { lat: number; lng: number };
  return { lat: json.lat, lng: json.lng };
}

// 좌표 기준 돌봄센터 검색 (백엔드 /places/care-centers 프록시). mock 모드는 더미 반환.
export async function searchCareCenters(
  coords: Coords | null,
  radius = 2000,
): Promise<CareCentersResult> {
  if (!IS_REAL) {
    return { items: MOCK_CARE_CENTERS, error: null };
  }
  if (!coords) return { items: [], error: null };
  try {
    const token = await getToken();
    const res = await fetch(
      `${API_BASE_URL}/places/care-centers?lat=${coords.lat}&lng=${coords.lng}&radius=${radius}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) return { items: [], error: "REQUEST_FAILED" };
    return (await res.json()) as CareCentersResult;
  } catch {
    return { items: [], error: "NETWORK_ERROR" };
  }
}
