// src/pages/PrivacyPolicyPage.tsx
// 설정 화면 + 온보딩 동의 화면에서 공용으로 사용하는 개인정보처리방침 화면
// 사용법:
//   1. 설정에서 → <PrivacyPolicyPage />  (onAgree 없이 → 닫기 버튼만)
//   2. 온보딩에서 → <PrivacyPolicyPage onAgree={handleAgree} />  (동의 버튼 표시)

import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_VERSION,
  PRIVACY_POLICY_DATE,
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_WARNING,
  PolicyContent,
} from '../constants/privacyPolicy';

// ─── 토큰 (tokens.ts 에서 import 해도 됨) ───
const COLORS = {
  coral: '#FF7955',
  amber: '#E8943A',
  ivory: '#FDECDD',
  dark: '#2C2C2A',
  gray: '#888780',
  grayLight: '#F5F4F0',
  grayBorder: '#E0DED8',
  amberBg: '#FFF8E1',
  amberBorder: '#E8943A',
  white: '#FFFFFF',
};

// ─── 컨텐츠 렌더러 ───
function renderContent(content: PolicyContent, index: number) {
  switch (content.type) {
    case 'subheading':
      return (
        <Text key={index} style={styles.subheading}>
          {content.text}
        </Text>
      );
    case 'body':
      return (
        <Text key={index} style={styles.body}>
          {content.text}
        </Text>
      );
    case 'bullet':
      return (
        <View key={index} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={[styles.bulletText, content.bold && styles.boldText]}>
            {content.text}
          </Text>
        </View>
      );
    case 'note':
      return (
        <View key={index} style={styles.noteBox}>
          <Text style={styles.noteText}>{content.text}</Text>
        </View>
      );
    default:
      return null;
  }
}

// ─── Props ───
interface PrivacyPolicyPageProps {
  /** 온보딩 동의 모드: 전달하면 하단에 "동의합니다" 버튼 표시 */
  onAgree?: () => void;
  /** 온보딩 모드에서 "동의 안함" 콜백 (선택) */
  onDisagree?: () => void;
}

// ─── 메인 컴포넌트 ───
export default function PrivacyPolicyPage({ onAgree, onDisagree }: PrivacyPolicyPageProps) {
  const router = useRouter();
  const isOnboardingMode = !!onAgree;

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        {!isOnboardingMode && (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel="뒤로 가기"
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>개인정보 처리방침</Text>
        <View style={styles.headerRight} />
      </View>

      {/* 스크롤 본문 */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 서비스명 + 버전 */}
        <View style={styles.titleBlock}>
          <Text style={styles.serviceName}>MOA</Text>
          <Text style={styles.versionText}>
            {PRIVACY_POLICY_VERSION} · {PRIVACY_POLICY_DATE} 시행
          </Text>
        </View>

        {/* 법적 포지셔닝 경고 */}
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>{PRIVACY_POLICY_WARNING}</Text>
        </View>

        {/* 인트로 */}
        <Text style={styles.intro}>{PRIVACY_POLICY_INTRO}</Text>

        {/* 조항 목록 */}
        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <View key={section.id} style={styles.section}>
            {/* 조항 헤더 */}
            <View style={styles.articleHeader}>
              <View style={styles.articleBadge}>
                <Text style={styles.articleBadgeText}>{section.article}</Text>
              </View>
              <Text style={styles.articleTitle}>{section.title}</Text>
            </View>

            {/* 조항 내용 */}
            <View style={styles.articleBody}>
              {section.content.map((item, i) => renderContent(item, i))}
            </View>
          </View>
        ))}

        {/* 하단 여백 (버튼 있을 때 가려지지 않게) */}
        <View style={{ height: isOnboardingMode ? 120 : 40 }} />
      </ScrollView>

      {/* 온보딩 모드: 하단 동의 버튼 */}
      {isOnboardingMode && (
        <View style={styles.agreeFooter}>
          {onDisagree && (
            <TouchableOpacity
              style={styles.disagreeButton}
              onPress={onDisagree}
              accessibilityLabel="동의하지 않음"
            >
              <Text style={styles.disagreeText}>동의 안함</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.agreeButton, !onDisagree && styles.agreeButtonFull]}
            onPress={onAgree}
            accessibilityLabel="개인정보처리방침에 동의합니다"
          >
            <Text style={styles.agreeButtonText}>동의합니다</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── 스타일 ───
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
    backgroundColor: COLORS.white,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 28,
    color: COLORS.dark,
    lineHeight: 32,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.dark,
  },
  headerRight: {
    width: 36,
  },

  // 스크롤
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  // 제목 블록
  titleBlock: {
    marginBottom: 16,
  },
  serviceName: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.coral,
    marginBottom: 4,
  },
  versionText: {
    fontSize: 13,
    color: COLORS.gray,
  },

  // 법적 경고 박스
  warningBox: {
    backgroundColor: COLORS.amberBg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.amber,
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 13,
    color: '#5F5E5A',
    lineHeight: 20,
  },

  // 인트로
  intro: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 22,
    marginBottom: 24,
  },

  // 조항
  section: {
    marginBottom: 28,
  },
  articleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.coral,
  },
  articleBadge: {
    backgroundColor: COLORS.coral,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  articleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark,
    flex: 1,
  },
  articleBody: {
    gap: 6,
  },

  // 컨텐츠 타입별
  subheading: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
    marginTop: 10,
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    color: COLORS.dark,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 4,
    gap: 8,
  },
  bulletDot: {
    fontSize: 14,
    color: COLORS.coral,
    lineHeight: 22,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.dark,
    lineHeight: 22,
  },
  boldText: {
    fontWeight: '600',
  },
  noteBox: {
    backgroundColor: COLORS.amberBg,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.amber,
    borderRadius: 4,
    padding: 10,
    marginTop: 6,
  },
  noteText: {
    fontSize: 13,
    color: '#5F5E5A',
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // 온보딩 동의 하단 버튼
  agreeFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
    backgroundColor: COLORS.white,
  },
  disagreeButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disagreeText: {
    fontSize: 16,
    color: COLORS.gray,
    fontWeight: '500',
  },
  agreeButton: {
    flex: 2,
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agreeButtonFull: {
    flex: 1,
  },
  agreeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});
