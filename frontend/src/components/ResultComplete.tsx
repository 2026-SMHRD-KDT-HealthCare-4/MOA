import type { ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Home,
  MessageCircle,
  Check,
  Volume2,
  Heart,
} from "lucide-react-native";
import { CharacterPlayer } from "./CharacterPlayer";

type ResultCompleteProps = {
  type: "conversation" | "record";
  onHome: () => void;
};

export function ResultComplete({ type, onHome }: ResultCompleteProps) {
  const isConversation = type === "conversation";

  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={["#FFF7EA", "#F7D6AC"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.container}>
        <Text style={styles.title}>
          {isConversation ? "대화 완료!" : "녹음 완료!"}
        </Text>

        <View style={styles.moaFrame}>
          <CharacterPlayer
            mood="happy"
            hasUserInteracted={true}
            bottomFadeColor="#F6C98F"
            containerStyle={styles.moaVideo}
          />
        </View>

        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View
              style={[
                styles.headerIcon,
                { backgroundColor: isConversation ? "#EEE6FF" : "#FFE8DD" },
              ]}
            >
              {isConversation ? (
                <MessageCircle size={33} color="#7B5BE6" strokeWidth={2.5} />
              ) : (
                <Volume2 size={33} color="#FF6D4A" strokeWidth={2.5} />
              )}
            </View>

            <Text style={styles.resultTitle}>
              {isConversation
                ? "오늘도 모아와\n즐겁게 이야기했어요!"
                : "오늘 목소리는\n맑은 편이에요!"}
            </Text>
          </View>

          <View style={styles.list}>
            <ResultRow
              bg="#DDF7EA"
              icon={<Check size={22} color="#31B978" strokeWidth={3} />}
              text={
                isConversation
                  ? "오늘 대화가 잘 기록되었어요."
                  : "충분한 음성이 기록되었어요."
              }
            />

            <ResultRow
              bg="#FFF0C9"
              icon={<Volume2 size={22} color="#F5A623" strokeWidth={2.8} />}
              text={
                isConversation
                  ? "충분한 음성을 확인했어요."
                  : "지정 문장을 잘 읽었어요."
              }
            />

            <ResultRow
              bg="#FFE1EA"
              icon={<Heart size={22} color="#F35C82" fill="#F35C82" />}
              text={
                isConversation
                  ? "내일도 모아와 이야기해요."
                  : "내일도 건강한 목소리로 만나요."
              }
            />
          </View>

          <Pressable style={styles.homeButton} onPress={onHome}>
            <Home size={27} color="#FFFFFF" strokeWidth={2.6} />
            <Text style={styles.homeButtonText}>홈으로 가기</Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          결과는 리포트에서 자세히 확인할 수 있어요.
        </Text>
      </View>
    </View>
  );
}

function ResultRow({
  icon,
  bg,
  text,
}: {
  icon: ReactNode;
  bg: string;
  text: string;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 50,
    alignItems: "center",
  },
  title: {
    fontFamily: "Pretendard-ExtraBold",
    fontSize: 31,
    lineHeight: 39,
    fontWeight: "900",
    color: "#3B2318",
    marginBottom: 18,
  },
  moaFrame: {
    width: "82%",
    height: 300,
    borderRadius: 42,
    backgroundColor: "#F6C98F",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 10,
  },
  moaVideo: {
    left: 0,
    right: 0,
    top: -60,
    bottom: -10,
  },
  resultCard: {
    width: "100%",
    borderRadius: 30,
    backgroundColor: "#FFFCF8",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    shadowColor: "#6E4A2C",
    shadowOpacity: 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  headerIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  resultTitle: {
    flex: 1,
    fontFamily: "Pretendard-ExtraBold",
    fontSize: 25,
    lineHeight: 34,
    fontWeight: "900",
    color: "#173F73",
  },
  list: {
    gap: 15,
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    fontFamily: "Pretendard-Bold",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "800",
    color: "#4B382D",
  },
  homeButton: {
    height: 66,
    borderRadius: 17,
    backgroundColor: "#173F73",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
  },
  homeButtonText: {
    fontFamily: "Pretendard-ExtraBold",
    fontSize: 23,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  note: {
    marginTop: 13,
    fontFamily: "Pretendard-Bold",
    fontSize: 13,
    color: "#7A6254",
  },
});
