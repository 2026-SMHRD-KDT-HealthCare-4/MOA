// app/privacy.tsx
// 최상위 공용 라우트 — 보호자/직접사용자 설정 양쪽에서 동일하게 진입 가능
// (guardian)/settings.tsx 와 (elder)/settings.tsx 모두 router.push('/privacy') 로 연결

import PrivacyPolicyPage from '../src/pages/PrivacyPolicyPage';

export default function PrivacyRoute() {
  // onAgree 없이 → 설정 화면에서 "닫기(뒤로)" 모드
  return <PrivacyPolicyPage />;
}
