import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { ChevronLeft, MapPin, Info } from "lucide-react-native";
import { colors } from "../../styles/tokens";

// 컬러는 tokens.ts 만 참조 (하드코딩 금지). 경고/강조는 앰버 단독, 레드 금지.
const C = {
  bg: colors.bg.warm,
  card: colors.guardianNavy.card,
  primary: colors.guardianNavy.primary,
  primaryDark: colors.guardianNavy.primaryDark,
  primaryLight: colors.guardianNavy.primaryLight,
  border: colors.guardianNavy.border,
  text: colors.guardianNavy.textMain,
  sub: colors.guardianNavy.textSub,
  muted: colors.guardianNavy.textMuted,
  amber: colors.alert,
  noticeBg: colors.guardian.cardPeach, // 앰버/피치 톤 배경 (레드 아님)
};

// 카카오맵 JS 키는 환경변수로만 주입 (하드코딩 절대 금지).
const KAKAO_MAP_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_KEY ?? "";

// WebView origin: 카카오 개발자콘솔 Web 플랫폼에 등록해야 지도가 로드된다.
const WEBVIEW_BASE_URL = "https://localhost";

const DEPARTMENTS = ["신경과", "정신건강의학과", "내과"] as const;
type Department = (typeof DEPARTMENTS)[number];

function isDepartment(value: unknown): value is Department {
  return typeof value === "string" && (DEPARTMENTS as readonly string[]).includes(value);
}

type Phase = "noKey" | "loading" | "denied" | "ready" | "error";

// 카카오맵 + 장소검색(services) 로 현재 위치 주변 진료과 병원을 표시하는 HTML.
function buildMapHtml(lat: number, lng: number, keyword: string, appKey: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }
  </style>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&libraries=services&autoload=false"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    kakao.maps.load(function () {
      var center = new kakao.maps.LatLng(${lat}, ${lng});
      var map = new kakao.maps.Map(document.getElementById('map'), { center: center, level: 5 });

      // 현재 위치 마커
      new kakao.maps.Marker({ map: map, position: center });

      var places = new kakao.maps.services.Places();
      places.keywordSearch(${JSON.stringify(keyword)}, function (data, status) {
        if (status !== kakao.maps.services.Status.OK) return;
        var bounds = new kakao.maps.LatLngBounds();
        bounds.extend(center);
        data.forEach(function (place) {
          var pos = new kakao.maps.LatLng(place.y, place.x);
          var marker = new kakao.maps.Marker({ map: map, position: pos });
          var info = new kakao.maps.InfoWindow({
            content: '<div style="padding:6px 8px;font-size:12px;white-space:nowrap;">' + place.place_name + '</div>'
          });
          kakao.maps.event.addListener(marker, 'click', function () { info.open(map, marker); });
          bounds.extend(pos);
        });
        map.setBounds(bounds);
      }, { location: center, radius: 5000, sort: kakao.maps.services.SortBy.DISTANCE });
    });
  </script>
</body>
</html>`;
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
  const [phase, setPhase] = useState<Phase>(KAKAO_MAP_KEY ? "loading" : "noKey");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const requestAndLocate = useCallback(async () => {
    if (!KAKAO_MAP_KEY) {
      setPhase("noKey");
      return;
    }
    setPhase("loading");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPhase("denied");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    requestAndLocate();
  }, [requestAndLocate]);

  const html = useMemo(
    () =>
      coords ? buildMapHtml(coords.lat, coords.lng, dept, KAKAO_MAP_KEY) : "",
    [coords, dept]
  );

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
              onPress={() => setDept(d)}
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

      {/* 지도 / 상태 영역 */}
      <View style={styles.mapWrap}>
        {phase === "ready" && coords && Platform.OS !== "web" ? (
          <WebView
            key={dept}
            originWhitelist={["*"]}
            source={{ html, baseUrl: WEBVIEW_BASE_URL }}
            javaScriptEnabled
            domStorageEnabled
            style={styles.webview}
          />
        ) : phase === "ready" && Platform.OS === "web" ? (
          <StateMessage
            title="지도는 모바일 앱에서 볼 수 있어요"
            body="웹 미리보기에서는 지도가 표시되지 않아요. Expo Go나 빌드된 앱에서 확인해 주세요."
          />
        ) : phase === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.primary} />
            <Text style={styles.loadingText}>근처 병원을 불러오는 중이에요…</Text>
          </View>
        ) : phase === "denied" ? (
          <StateMessage
            title="위치 권한이 필요해요"
            body="근처 병원을 보려면 위치 접근을 허용해 주세요."
            primaryLabel="다시 시도"
            onPrimary={requestAndLocate}
            secondaryLabel="설정에서 권한 켜기"
            onSecondary={() => Linking.openSettings()}
          />
        ) : phase === "noKey" ? (
          <StateMessage
            title="지도 키가 설정되지 않았어요"
            body="EXPO_PUBLIC_KAKAO_MAP_KEY 환경변수를 설정한 뒤 앱을 다시 시작해 주세요."
          />
        ) : (
          <StateMessage
            title="병원 정보를 불러오지 못했어요"
            body="잠시 후 다시 시도해 주세요."
            primaryLabel="다시 시도"
            onPrimary={requestAndLocate}
          />
        )}
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
    backgroundColor: C.card,
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
  mapWrap: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 17,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  webview: { flex: 1, backgroundColor: "transparent" },
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
    backgroundColor: C.card,
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
