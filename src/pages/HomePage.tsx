import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { HeartPulse, MessageCircle, Mic } from "lucide-react-native";
import { TopBar } from "../components/layout/TopBar";
import { MoaAvatar } from "../components/MoaAvatar";

export default function HomePage() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={["#fffdfb", "#fff7f1", "#ffffff"]}
      locations={[0, 0.67, 0.67]}
      style={styles.container}
    >
      <TopBar />

      {/* 인사말 */}
      <View style={styles.intro}>
        <Text style={styles.introSub}>오늘도 만나서 반가워요</Text>
        <Text style={styles.introTitle}>모아와 무엇을{"\n"}해볼까요?</Text>
      </View>

      {/* 아바타 + 액션 버블 */}
      <View style={styles.stage}>
        {/* 대화하기 버블 (좌) */}
        <TouchableOpacity
          style={[styles.bubble, styles.bubbleChat]}
          onPress={() => router.push("/chat")}
          activeOpacity={0.85}
        >
          <View style={[styles.bubbleIcon, styles.bubbleIconChat]}>
            <MessageCircle size={20} color="white" />
          </View>
          <Text style={styles.bubbleTitle}>대화하기</Text>
          <Text style={styles.bubbleDesc}>마음 편히 이야기해요</Text>
          <View style={[styles.tail, styles.tailRight]} />
        </TouchableOpacity>

        {/* 아바타 (중앙) */}
        <View style={styles.avatarWrap}>
          <View style={styles.helloBadge}>
            <Text style={styles.helloBadgeText}>안녕하세요! 👋</Text>
          </View>
          <MoaAvatar emotion="greeting" size={235} />
          <View style={styles.moaName}>
            <View style={styles.moaNameDot} />
            <Text style={styles.moaNameText}>MOA</Text>
          </View>
        </View>

        {/* 녹음하기 버블 (우) */}
        <TouchableOpacity
          style={[styles.bubble, styles.bubbleRecord]}
          onPress={() => router.push("/record")}
          activeOpacity={0.85}
        >
          <View style={[styles.bubbleIcon, styles.bubbleIconRecord]}>
            <Mic size={20} color="#FF706D" />
          </View>
          <Text style={styles.bubbleTitle}>녹음하기</Text>
          <Text style={styles.bubbleDesc}>목소리로 건강 체크</Text>
          <View style={[styles.tail, styles.tailLeft]} />
        </TouchableOpacity>
      </View>

      {/* 오늘의 한마디 */}
      <View style={styles.dailyCard}>
        <View style={styles.dailyIcon}>
          <HeartPulse size={21} color="#ff6d69" />
        </View>
        <View style={styles.dailyContent}>
          <Text style={styles.dailyTitle}>오늘의 한마디</Text>
          <Text style={styles.dailyText}>
            천천히 이야기해도 괜찮아요.{"\n"}모아가 끝까지 들어드릴게요.
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  intro: {
    paddingTop: 17,
    paddingHorizontal: 4,
  },
  introSub: {
    color: "#a18f88",
    fontSize: 18,
    marginBottom: 5,
  },
  introTitle: {
    color: "#362b27",
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 36,
  },
  stage: {
    flex: 1,
    minHeight: 375,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrap: {
    alignItems: "center",
    zIndex: 1,
  },
  avatarPlaceholder: {
    width: 235,
    height: 235,
    borderRadius: 118,
    backgroundColor: "#fff7f4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#ffd4d1",
  },
  avatarEmoji: {
    fontSize: 110,
  },
  onlineDot: {
    position: "absolute",
    bottom: 20,
    left: 20,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2ECC71",
    borderWidth: 2,
    borderColor: "white",
  },
  helloBadge: {
    position: "absolute",
    top: 4,
    right: -10,
    zIndex: 2,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: "white",
    borderRadius: 14,
    shadowColor: "#5b3a2c",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 6,
  },
  helloBadgeText: {
    color: "#76564e",
    fontSize: 18,
    fontWeight: "700",
  },
  moaName: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -12,
  },
  moaNameDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#4fd3a6",
  },
  moaNameText: {
    color: "#8b7871",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
  },
  bubble: {
    position: "absolute",
    width: 132,
    minHeight: 91,
    padding: 14,
    borderRadius: 21,
    shadowColor: "#64402f",
    shadowOffset: { width: 0, height: 13 },
    shadowOpacity: 0.13,
    shadowRadius: 30,
    elevation: 6,
    justifyContent: "center",
  },
  bubbleChat: {
    top: 42,
    left: 0,
    backgroundColor: "#ffdedb",
  },
  bubbleRecord: {
    right: 0,
    bottom: 46,
    backgroundColor: "white",
  },
  bubbleIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  bubbleIconChat: {
    backgroundColor: "#FF706D",
  },
  bubbleIconRecord: {
    backgroundColor: "#ffebe8",
  },
  bubbleTitle: {
    color: "#5f4c45",
    fontSize: 18,
    fontWeight: "700",
  },
  bubbleDesc: {
    color: "#a18d86",
    fontSize: 13,
    marginTop: 3,
  },
  tail: {
    position: "absolute",
    bottom: -8,
    width: 18,
    height: 18,
    transform: [{ rotate: "45deg" }],
  },
  tailRight: {
    right: 20,
    backgroundColor: "#ffdedb",
  },
  tailLeft: {
    left: 20,
    backgroundColor: "white",
  },
  dailyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    padding: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#f0e4de",
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.94)",
    shadowColor: "#54372b",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 25,
    elevation: 3,
  },
  dailyIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#fff0ed",
    alignItems: "center",
    justifyContent: "center",
  },
  dailyContent: {
    flex: 1,
  },
  dailyTitle: {
    color: "#292321",
    fontSize: 18,
    fontWeight: "700",
  },
  dailyText: {
    color: "#93837d",
    fontSize: 16,
    lineHeight: 25,
    marginTop: 3,
  },
});
