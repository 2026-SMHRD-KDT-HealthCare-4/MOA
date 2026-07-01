import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, MapPin, Phone, Info } from "lucide-react-native";
import { colors } from "../../styles/tokens";
import { getToken } from "../../api/session";

// const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://101.79.22.22").replace(
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

// 컬러는 tokens.ts 만 참조 (하드코딩 금지). 경고/강조는 앰버 단독, 레드 금지.
const C = {
  bg: colors.bg.warm,
  card: colors.guardian.cardPeach, // 카드 배경: 따뜻한 아이보리 #FDECDD
  primary: colors.guardianNavy.primary,
  border: colors.guardianNavy.border,
  inputBg: colors.guardianNavy.card,
  text: colors.guardianNavy.textMain,
  sub: colors.guardianNavy.textSub,
  muted: colors.guardianNavy.textMuted,
  amber: colors.alert,
  noticeBg: colors.guardian.cardPeach, // 앰버/피치 톤 배경 (레드 아님)
};

// 카카오 API 호출 키와 로직은 백엔드로 전면 이관되었습니다.
const SEARCH_RADIUS = 2000; // 반경 2km

const DEPARTMENTS = ["신경과", "정신건강의학과", "내과"] as const;
type Department = (typeof DEPARTMENTS)[number];

function isDepartment(value: unknown): value is Department {
  return typeof value === "string" && (DEPARTMENTS as readonly string[]).includes(value);
}

type Coords = { lat: number; lng: number };
type Phase = "idle" | "loading" | "addressNotFound" | "error" | "empty" | "ready";

interface Hospital {
  id: string;
  name: string;
  address: string;
  distance?: string;
  phone?: string;
  url?: string;
}

// === 주소 → 좌표 변환 (카카오 지오코딩) =====================================
// 분리된 단일 책임 함수. 나중에 직접사용자 주소를 DB/API 에서 불러오게 되면,
// 이 함수 '호출 전에' 주소를 불러오는 코드만 추가하면 되고 이 함수와 이후 로직은
// 그대로 재사용한다. 좌표를 찾으면 {lat,lng}, 못 찾으면 null.
async function getCoordsByAddress(address: string): Promise<Coords | null> {
  const token = await getToken();
  const url = `${API_BASE_URL}/hospital/geocode?address=${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { lat: number; lng: number };
  return { lat: json.lat, lng: json.lng };
}

// === 좌표 기준 병원 검색 (카카오 키워드 검색) ===============================
async function searchHospitals(dept: Department, coords: Coords): Promise<Hospital[]> {
  const token = await getToken();
  const url = `${API_BASE_URL}/hospital/search-nearby?dept=${encodeURIComponent(dept)}&lat=${coords.lat}&lng=${coords.lng}&radius=${SEARCH_RADIUS}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("hospital search failed");
  const json = (await res.json()) as Hospital[];
  return json;
}

// 근처 전문의 찾기 — 부모님(직접사용자) 주소를 기준으로 병원을 찾는다.
// 보호자 기기 GPS 가 아니라 입력한 주소 위치를 쓰므로 위치 권한은 사용하지 않는다.
export default function NearbyHospitalsPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ dept?: string }>();

  const [dept, setDept] = useState<Department>(
    isDepartment(params.dept) ? params.dept : "신경과"
  );
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");

  // 좌표가 정해진 뒤 진료과로 병원 목록을 갱신한다(지오코딩 재호출 없음).
  const loadHospitals = useCallback(async (targetDept: Department, c: Coords) => {
    setPhase("loading");
    try {
      const list = await searchHospitals(targetDept, c);
      setHospitals(list);
      setPhase(list.length ? "ready" : "empty");
    } catch {
      setPhase("error");
    }
  }, []);

  // 주소 → 좌표 변환 후 병원 검색까지 수행하는 메인 흐름.
  //
  // ▼▼ 나중에 자동화할 지점 ▼▼
  //   지금은 보호자가 입력한 `address` 를 그대로 사용한다.
  //   직접사용자 주소가 DB 에 저장되면, 아래 runSearch 를 호출하기 전에
  //     const addr = await fetchSeniorAddress(seniorId);  // API 추가
  //   로 주소를 불러와 runSearch(addr) 로 넘기기만 하면 된다. 이하 로직 동일.
  // ▲▲
  const runSearch = useCallback(
    async (addr: string, targetDept: Department) => {
      if (!addr.trim()) {
        setPhase("idle");
        return;
      }
      setPhase("loading");
      try {
        const c = await getCoordsByAddress(addr.trim());
        if (!c) {
          setPhase("addressNotFound");
          return;
        }
        setCoords(c);
        await loadHospitals(targetDept, c);
      } catch {
        setPhase("error");
      }
    },
    [loadHospitals]
  );

  function handleSearch() {
    void runSearch(address, dept);
  }

  function onSelectDept(d: Department) {
    setDept(d);
    // 이미 좌표가 있으면 재지오코딩 없이 병원만 다시 검색
    if (coords) void loadHospitals(d, coords);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={8}
        >
          <ChevronLeft size={26} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>근처 전문의 찾기</Text>
        <View style={styles.backButton} />
      </View>

      {/* 안내 문구 — 진단 표현 금지, 정해진 카피만 사용 */}
      <View style={styles.notice}>
        <Info size={18} color={C.amber} />
        <Text style={styles.noticeText}>
          목소리 변화가 감지됐어요. 전문의 상담을 고려해보세요.
        </Text>
      </View>

      {/* 주소 입력 */}
      <View style={styles.searchSection}>
        <Text style={styles.searchLabel}>부모님 주소를 입력해주세요</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.addressInput}
            value={address}
            onChangeText={setAddress}
            placeholder="예: 광주광역시 서구 치평동"
            placeholderTextColor={C.muted}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            accessibilityLabel="부모님 주소 입력"
          />
          <Pressable
            style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
            onPress={handleSearch}
            accessibilityRole="button"
            accessibilityLabel="주소로 병원 검색"
          >
            <Text style={styles.searchButtonText}>검색</Text>
          </Pressable>
        </View>
      </View>

      {/* 진료과 선택 칩 */}
      <View style={styles.deptRow}>
        {DEPARTMENTS.map((d) => {
          const active = d === dept;
          return (
            <Pressable
              key={d}
              style={[styles.deptChip, active && styles.deptChipActive]}
              onPress={() => onSelectDept(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${d} 검색`}
            >
              <Text style={[styles.deptChipText, active && styles.deptChipTextActive]}>
                {d}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 디버그용 현재 좌표 표시 */}
      {coords ? (
        <Text style={styles.debugCoords}>
          {`위도: ${coords.lat.toFixed(4)} / 경도: ${coords.lng.toFixed(4)}`}
        </Text>
      ) : null}

      {/* 결과 영역 */}
      <View style={styles.content}>{renderContent()}</View>
    </View>
  );

  function renderContent() {
    if (phase === "ready") {
      return (
        <FlatList
          data={hospitals}
          keyExtractor={(h) => h.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          renderItem={({ item }) => <HospitalCard hospital={item} />}
        />
      );
    }
    if (phase === "loading") {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} />
          <Text style={styles.loadingText}>병원을 찾는 중이에요…</Text>
        </View>
      );
    }
    if (phase === "idle") {
      return (
        <StateMessage
          title="부모님 주소로 검색해요"
          body="부모님이 계신 주소를 입력하고 검색을 누르면 그 주변 병원을 보여드려요."
        />
      );
    }
    if (phase === "addressNotFound") {
      return (
        <StateMessage
          title="주소를 찾지 못했어요"
          body="동·도로명까지 포함해 다시 입력해 주세요. (예: 광주광역시 서구 치평동)"
        />
      );
    }
    if (phase === "empty") {
      return (
        <StateMessage
          title="주변에 검색 결과가 없어요"
          body={`반경 ${SEARCH_RADIUS / 1000}km 안에서 ${dept}를 찾지 못했어요.`}
        />
      );
    }
    return (
      <StateMessage
        title="병원 정보를 불러오지 못했어요"
        body="잠시 후 다시 시도해 주세요."
        primaryLabel="다시 시도"
        onPrimary={handleSearch}
      />
    );
  }
}

function HospitalCard({ hospital }: { hospital: Hospital }) {
  const openUrl = hospital.url ? () => Linking.openURL(hospital.url as string) : undefined;
  // 카드 전체(상세 보기)와 전화 버튼은 형제로 분리한다.
  // (웹에서 버튼 안에 버튼이 중첩되면 DOM 경고가 발생하기 때문)
  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [styles.cardTop, pressed && openUrl ? styles.pressed : null]}
        onPress={openUrl}
        disabled={!openUrl}
        accessibilityRole={openUrl ? "button" : undefined}
        accessibilityLabel={`${hospital.name} 상세 보기`}
      >
        <Text style={styles.cardName} numberOfLines={1}>
          {hospital.name}
        </Text>
        <View style={styles.cardRow}>
          <MapPin size={14} color={C.muted} />
          <Text style={styles.cardAddress} numberOfLines={2}>
            {hospital.address || "주소 정보 없음"}
          </Text>
        </View>
      </Pressable>

      <View style={styles.cardMetaRow}>
        {hospital.distance ? (
          <Text style={styles.cardDistance}>{hospital.distance}</Text>
        ) : (
          <View />
        )}
        {hospital.phone ? (
          <Pressable
            style={styles.callButton}
            onPress={() => Linking.openURL(`tel:${hospital.phone}`)}
            accessibilityRole="button"
            accessibilityLabel={`${hospital.name} 전화 걸기`}
            hitSlop={6}
          >
            <Phone size={14} color={C.primary} />
            <Text style={styles.callText}>{hospital.phone}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function StateMessage({
  title,
  body,
  primaryLabel,
  onPrimary,
}: {
  title: string;
  body: string;
  primaryLabel?: string;
  onPrimary?: () => void;
}) {
  return (
    <View style={styles.center}>
      <MapPin size={30} color={C.muted} />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
      {primaryLabel && onPrimary ? (
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={onPrimary}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
        >
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
  },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontFamily: "Pretendard-ExtraBold",
    fontSize: 20,
    color: C.text,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: C.noticeBg,
  },
  noticeText: {
    flex: 1,
    fontFamily: "Pretendard-Bold",
    fontSize: 14,
    lineHeight: 20,
    color: C.text,
  },

  // 주소 입력
  searchSection: { paddingHorizontal: 20, marginBottom: 12, gap: 8 },
  searchLabel: {
    fontFamily: "Pretendard-Bold",
    fontSize: 14,
    color: C.text,
  },
  searchRow: { flexDirection: "row", gap: 8 },
  addressInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    fontFamily: "Pretendard-Medium",
    fontSize: 15,
    color: C.text,
  },
  searchButton: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.primary,
  },
  searchButtonText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },

  deptRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  deptChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
  },
  deptChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  deptChipText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 14,
    color: C.sub,
  },
  deptChipTextActive: { color: "#FFFFFF" },
  debugCoords: {
    fontFamily: "Pretendard-Medium",
    fontSize: 12,
    color: C.muted,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  content: { flex: 1 },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 2,
    gap: 10,
  },

  // 병원 카드
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cardTop: { gap: 8 },
  cardName: {
    fontFamily: "Pretendard-Bold",
    fontSize: 16,
    color: C.text,
  },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  cardAddress: {
    flex: 1,
    fontFamily: "Pretendard-Medium",
    fontSize: 13.5,
    lineHeight: 19,
    color: C.sub,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 2,
  },
  cardDistance: {
    fontFamily: "Pretendard-Bold",
    fontSize: 13.5,
    color: C.primary,
  },
  callButton: { flexDirection: "row", alignItems: "center", gap: 5 },
  callText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 13.5,
    color: C.primary,
  },

  // 상태 메시지
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 28,
  },
  loadingText: {
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
    color: C.sub,
  },
  stateTitle: {
    fontFamily: "Pretendard-Bold",
    fontSize: 17,
    color: C.text,
    textAlign: "center",
    marginTop: 2,
  },
  stateBody: {
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
    lineHeight: 21,
    color: C.sub,
    textAlign: "center",
  },
  primaryButton: {
    marginTop: 6,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.primary,
  },
  primaryButtonText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  pressed: { opacity: 0.85 },
});
