// 근처 돌봄센터 찾기 카드 — 보호자 리포트 내 "근처 전문의 찾기" 카드 바로 아래에 배치.
//
// - 병원 찾기(카카오 카테고리 검색)와 달리 이 기능은 키워드 검색 기반이라 내부 로직/데이터 소스가
//   다르므로 컴포넌트를 별도로 유지한다(병원 카드와 병합 금지).
// - 카카오는 프론트에서 직접 호출하지 않고 백엔드 프록시(/places/care-centers, /hospital/geocode)만 호출.
// - 이 카드는 경보 카드가 아닌 '중립 정보 카드'다 → 경고색(앰버)·레드 사용 안 함. tokens.ts 토큰만 사용.
// - 자격 판정(장기요양등급 해당 여부 등) 안내는 작성하지 않는다. 위치 정보 + 공식 홈페이지 링크만 제공.
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from "react-native";
import { MapPin, Phone, Info, ExternalLink } from "lucide-react-native";
import { colors } from "../../styles/tokens";
import {
  geocodeAddress,
  searchCareCenters,
  type Coords,
  type Place,
} from "../../api/places";

const IS_REAL = process.env.EXPO_PUBLIC_AUTH_API_MODE === "real";
const SEARCH_RADIUS = 2000; // 반경 2km
const MAX_RESULTS = 5;
const LONGTERMCARE_URL = "https://www.longtermcare.or.kr"; // 보건복지부 장기요양보험 공식 홈페이지
const WELFARE_CALL_CENTER = "129"; // 보건복지부 콜센터(국번 없이)

// 컬러는 tokens.ts 만 참조(하드코딩 금지). 형제 화면 NearbyHospitalsPage 와 동일 토큰 사용.
// 중립 정보 카드 — 경고색(앰버)·레드 미사용.
const C = {
  card: colors.guardian.card, // 카드 배경(흰색) — 리포트 카드와 동일
  itemBg: colors.guardian.cardPeach, // 결과 항목 배경(피치 톤) — 병원 카드와 동일
  border: colors.guardianNavy.border,
  inputBg: colors.guardianNavy.card,
  primary: colors.guardianNavy.primary, // 네이비 강조(버튼·거리·전화)
  text: colors.guardianNavy.textMain,
  sub: colors.guardianNavy.textSub,
  muted: colors.guardianNavy.textMuted,
};

type Phase = "idle" | "loading" | "addressNotFound" | "error" | "empty" | "ready";

function formatDistance(d?: string): string | undefined {
  if (!d) return undefined;
  const m = Number(d);
  if (!Number.isFinite(m)) return undefined;
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

export default function CareCenterCard() {
  const [address, setAddress] = useState("");
  const [centers, setCenters] = useState<Place[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");

  async function handleSearch() {
    setPhase("loading");
    try {
      let coords: Coords | null = null;
      if (IS_REAL) {
        if (!address.trim()) {
          setPhase("idle");
          return;
        }
        coords = await geocodeAddress(address.trim());
        if (!coords) {
          setPhase("addressNotFound");
          return;
        }
      }
      const result = await searchCareCenters(coords, SEARCH_RADIUS);
      if (result.error) {
        setPhase("error");
        return;
      }
      setCenters(result.items.slice(0, MAX_RESULTS));
      setPhase(result.items.length ? "ready" : "empty");
    } catch {
      setPhase("error");
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>근처 돌봄센터 찾기</Text>
      <Text style={styles.lead}>
        부모님 주소 주변의 재가·주야간보호·복지관 등 돌봄센터를 찾아드려요.
      </Text>

      {/* 주소 입력 + 검색 */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.addressInput}
          value={address}
          onChangeText={setAddress}
          placeholder="예: 광주광역시 서구 치평동"
          placeholderTextColor={C.muted}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          accessibilityLabel="돌봄센터를 찾을 주소 입력"
        />
        <Pressable
          style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
          onPress={handleSearch}
          accessibilityRole="button"
          accessibilityLabel="주소로 돌봄센터 검색"
        >
          <Text style={styles.searchButtonText}>검색</Text>
        </Pressable>
      </View>

      {/* 결과 / 상태 */}
      <View style={styles.resultArea}>{renderResult()}</View>

      {/* 하단 고정 디스클레이머 — 자격 판정 안내가 아닌, 공식 절차 안내 링크만 제공 */}
      <Pressable
        style={styles.disclaimer}
        onPress={() => Linking.openURL(LONGTERMCARE_URL)}
        accessibilityRole="link"
        accessibilityLabel="보건복지부 장기요양보험 홈페이지 열기"
      >
        <Info size={15} color={C.muted} />
        <Text style={styles.disclaimerText}>
          장기요양등급 신청 등 자세한 절차는 보건복지부 장기요양보험 홈페이지를 참고하세요.
        </Text>
        <ExternalLink size={14} color={C.muted} />
      </Pressable>
    </View>
  );

  function renderResult() {
    if (phase === "loading") {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} />
          <Text style={styles.stateBody}>돌봄센터를 찾는 중이에요…</Text>
        </View>
      );
    }
    if (phase === "ready") {
      return (
        <View style={styles.list}>
          {centers.map((c) => (
            <CareCenterItem key={c.id ?? `${c.lat},${c.lng}`} place={c} />
          ))}
        </View>
      );
    }
    if (phase === "addressNotFound") {
      return (
        <StateBlock
          title="주소를 찾지 못했어요"
          body="동·도로명까지 포함해 다시 입력해 주세요. (예: 광주광역시 서구 치평동)"
        />
      );
    }
    if (phase === "empty") {
      return (
        <StateBlock
          title="근처에 등록된 돌봄센터 정보가 없어요"
          body={`보건복지부 콜센터(국번 없이 ${WELFARE_CALL_CENTER})로 문의하시면 안내받을 수 있어요.`}
          actionLabel={`${WELFARE_CALL_CENTER} 전화하기`}
          onAction={() => Linking.openURL(`tel:${WELFARE_CALL_CENTER}`)}
        />
      );
    }
    if (phase === "error") {
      return (
        <StateBlock
          title="돌봄센터 정보를 불러오지 못했어요"
          body="잠시 후 다시 시도해 주세요."
          actionLabel="다시 시도"
          onAction={handleSearch}
        />
      );
    }
    // idle
    return (
      <StateBlock
        title="부모님 주소로 검색해요"
        body="주소를 입력하고 검색을 누르면 그 주변 돌봄센터를 보여드려요."
      />
    );
  }
}

function CareCenterItem({ place }: { place: Place }) {
  const distance = formatDistance(place.distance);
  return (
    <View style={styles.item}>
      <Text style={styles.itemName} numberOfLines={1}>
        {place.name}
      </Text>
      <View style={styles.itemRow}>
        <MapPin size={14} color={C.muted} />
        <Text style={styles.itemAddress} numberOfLines={2}>
          {place.address || "주소 정보 없음"}
        </Text>
      </View>
      <View style={styles.itemMetaRow}>
        {distance ? <Text style={styles.itemDistance}>{distance}</Text> : <View />}
        {place.phone ? (
          <Pressable
            style={styles.callButton}
            onPress={() => Linking.openURL(`tel:${place.phone}`)}
            accessibilityRole="button"
            accessibilityLabel={`${place.name} 전화 걸기`}
            hitSlop={6}
          >
            <Phone size={14} color={C.primary} />
            <Text style={styles.callText}>{place.phone}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function StateBlock({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <MapPin size={26} color={C.muted} />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
      {actionLabel && onAction ? (
        <Pressable
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    gap: 10,
  },
  // 핵심 텍스트(제목·시설명)는 18pt 유지. 보조 텍스트는 더 작게.
  title: {
    fontFamily: "Pretendard-ExtraBold",
    fontSize: 18,
    color: C.text,
  },
  lead: {
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
    lineHeight: 20,
    color: C.sub,
  },
  searchRow: { flexDirection: "row", gap: 8 },
  addressInput: {
    flex: 1,
    height: 46,
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
    height: 46,
    paddingHorizontal: 18,
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
  resultArea: { marginTop: 2 },
  list: { gap: 10 },

  // 결과 항목 (병원 카드와 동일 패턴)
  item: {
    backgroundColor: C.itemBg,
    borderRadius: 14,
    padding: 14,
    gap: 7,
  },
  itemName: {
    fontFamily: "Pretendard-Bold",
    fontSize: 18,
    color: C.text,
  },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  itemAddress: {
    flex: 1,
    fontFamily: "Pretendard-Medium",
    fontSize: 13.5,
    lineHeight: 19,
    color: C.sub,
  },
  itemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 2,
  },
  itemDistance: {
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
  center: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 22 },
  stateTitle: {
    fontFamily: "Pretendard-Bold",
    fontSize: 16,
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
  actionButton: {
    marginTop: 6,
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.primary,
  },
  actionButtonText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },

  // 하단 디스클레이머 (중립 정보)
  disclaimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: "Pretendard-Medium",
    fontSize: 12.5,
    lineHeight: 18,
    color: C.muted,
  },
  pressed: { opacity: 0.85 },
});
