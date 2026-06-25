import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { ChevronLeft, MapPin, Phone, Info } from "lucide-react-native";
import { colors } from "../../styles/tokens";

// 컬러는 tokens.ts 만 참조 (하드코딩 금지). 경고/강조는 앰버 단독, 레드 금지.
const C = {
  bg: colors.bg.warm,
  card: colors.guardian.cardPeach, // 카드 배경: 따뜻한 아이보리 #FDECDD
  primary: colors.guardianNavy.primary,
  border: colors.guardianNavy.border,
  text: colors.guardianNavy.textMain,
  sub: colors.guardianNavy.textSub,
  muted: colors.guardianNavy.textMuted,
  amber: colors.alert,
  noticeBg: colors.guardian.cardPeach, // 앰버/피치 톤 배경 (레드 아님)
};

// 카카오 로컬 REST 키는 환경변수로만 주입 (하드코딩 절대 금지).
const KAKAO_REST_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY ?? "";

const KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const SEARCH_RADIUS = 2000; // 반경 2km

const DEPARTMENTS = ["신경과", "정신건강의학과", "내과"] as const;
type Department = (typeof DEPARTMENTS)[number];

function isDepartment(value: unknown): value is Department {
  return typeof value === "string" && (DEPARTMENTS as readonly string[]).includes(value);
}

type Coords = { lat: number; lng: number };
type Phase = "noKey" | "loading" | "denied" | "error" | "empty" | "ready";

interface Hospital {
  id: string;
  name: string;
  address: string;
  distance?: string;
  phone?: string;
  url?: string;
}

// 카카오 키워드 검색 응답 document 중 사용하는 필드만 정의.
interface KakaoDocument {
  id: string;
  place_name: string;
  address_name?: string;
  road_address_name?: string;
  phone?: string;
  distance?: string;
  place_url?: string;
}

function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
}

function toHospital(doc: KakaoDocument): Hospital {
  return {
    id: doc.id,
    name: doc.place_name,
    address: doc.road_address_name || doc.address_name || "",
    distance: doc.distance ? formatDistance(Number(doc.distance)) : undefined,
    phone: doc.phone || undefined,
    url: doc.place_url || undefined,
  };
}

// 근처 전문의 찾기 — 리포트에서 진료과 버튼을 누르면 진입. 이 화면이 마운트될 때만
// 위치 권한을 요청하므로(= 버튼 트리거), 앱 시작 시 권한을 묻지 않는다.
export default function NearbyHospitalsPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ dept?: string }>();

  const [dept, setDept] = useState<Department>(
    isDepartment(params.dept) ? params.dept : "신경과"
  );
  const [phase, setPhase] = useState<Phase>(KAKAO_REST_KEY ? "loading" : "noKey");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  // 현재 위치 확보(권한 요청 포함). 거부 시 denied 로 전환하고 null 반환.
  const ensureCoords = useCallback(async (): Promise<Coords | null> => {
    if (coords) return coords;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setPhase("denied");
      return null;
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    setCoords(next);
    return next;
  }, [coords]);

  // 카카오 로컬 키워드 검색으로 진료과 병원 목록을 가져온다.
  const load = useCallback(
    async (targetDept: Department) => {
      if (!KAKAO_REST_KEY) {
        setPhase("noKey");
        return;
      }
      setPhase("loading");
      try {
        const c = await ensureCoords();
        if (!c) return; // 권한 거부 → ensureCoords 가 denied 설정

        const url =
          `${KAKAO_KEYWORD_URL}?query=${encodeURIComponent(targetDept)}` +
          `&x=${c.lng}&y=${c.lat}&radius=${SEARCH_RADIUS}&sort=distance`;
        const res = await fetch(url, {
          headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
        });
        if (!res.ok) {
          setPhase("error");
          return;
        }
        const json = (await res.json()) as { documents?: KakaoDocument[] };
        const list = (json.documents ?? []).map(toHospital);
        setHospitals(list);
        setPhase(list.length ? "ready" : "empty");
      } catch {
        setPhase("error");
      }
    },
    [ensureCoords]
  );

  // 최초 진입(= 버튼으로 들어온 시점)에 1회 로드. 이후 칩 탭은 onSelectDept 가 처리.
  useEffect(() => {
    void load(dept);
    // 마운트 시 1회만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSelectDept(d: Department) {
    setDept(d);
    void load(d);
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
          <Text style={styles.loadingText}>근처 병원을 불러오는 중이에요…</Text>
        </View>
      );
    }
    if (phase === "denied") {
      return (
        <StateMessage
          title="위치 권한이 필요해요"
          body="근처 병원을 보려면 위치 접근을 허용해 주세요."
          primaryLabel="다시 시도"
          onPrimary={() => load(dept)}
          secondaryLabel="설정에서 권한 켜기"
          onSecondary={() => Linking.openSettings()}
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
    if (phase === "noKey") {
      return (
        <StateMessage
          title="검색 키가 설정되지 않았어요"
          body="EXPO_PUBLIC_KAKAO_REST_KEY 환경변수를 설정한 뒤 앱을 다시 시작해 주세요."
        />
      );
    }
    return (
      <StateMessage
        title="병원 정보를 불러오지 못했어요"
        body="잠시 후 다시 시도해 주세요."
        primaryLabel="다시 시도"
        onPrimary={() => load(dept)}
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
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  body: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
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
      {secondaryLabel && onSecondary ? (
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={onSecondary}
          accessibilityRole="button"
          accessibilityLabel={secondaryLabel}
        >
          <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
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
    backgroundColor: colors.guardianNavy.card,
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
  secondaryButton: {
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.guardianNavy.card,
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  secondaryButtonText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 14,
    color: C.primary,
  },
  pressed: { opacity: 0.85 },
});
