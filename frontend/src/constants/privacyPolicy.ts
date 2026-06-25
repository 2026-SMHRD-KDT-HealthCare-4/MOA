// src/constants/privacyPolicy.ts
// MOA 개인정보처리방침 v1.0 — 2026.07.01 시행
// 앱 내 설정 화면 + 온보딩 동의 화면 공용 데이터

export const PRIVACY_POLICY_VERSION = 'v1.0';
export const PRIVACY_POLICY_DATE = '2026년 7월 1일';

export interface PolicySection {
  id: string;
  article: string;       // 조항 번호 (예: "제1조")
  title: string;         // 조항 제목
  content: PolicyContent[];
}

export type PolicyContent =
  | { type: 'body'; text: string }
  | { type: 'bullet'; text: string; bold?: boolean }
  | { type: 'note'; text: string }
  | { type: 'subheading'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] };

export const PRIVACY_POLICY_INTRO = `MOA(이하 "서비스")는 이용자의 개인정보를 소중히 여기며, 개인정보보호법 및 관련 법령을 준수합니다. 본 방침은 서비스가 수집하는 개인정보의 항목, 이용 목적, 보유 기간 및 이용자의 권리에 대해 안내합니다.`;

export const PRIVACY_POLICY_WARNING = `⚠️ MOA는 의료기기가 아닌 웰니스 서비스입니다. 제공되는 모든 음성 건강 정보는 참고용이며, 의학적 진단·처방·치료를 대체하지 않습니다.`;

export const PRIVACY_POLICY_SECTIONS: PolicySection[] = [
  {
    id: 'article1',
    article: '제1조',
    title: '수집하는 개인정보의 항목',
    content: [
      { type: 'body', text: 'MOA는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.' },
      { type: 'subheading', text: '1. 직접사용자 (서비스 직접 이용자)' },
      { type: 'bullet', text: '[필수] 이름(또는 닉네임), 생년월일, 보호자 연동 코드' },
      { type: 'bullet', text: '[선택] 연락처(전화번호)' },
      { type: 'bullet', text: '[민감정보 — 별도 동의 필수] 음성 바이오마커 특징벡터 (F0, Jitter, Shimmer, MFCC, HNR 등 수치 데이터)', bold: true },
      { type: 'bullet', text: '[자동 수집] 앱 버전, 기기 OS 및 모델, 체크인 일시, 서비스 이용 로그' },
      { type: 'subheading', text: '2. 보호자 (보조 사용자)' },
      { type: 'bullet', text: '[필수] 이름, 이메일 주소' },
      { type: 'bullet', text: '[소셜 로그인 시] 소셜 계정 식별자 (카카오·구글·네이버 중 선택, 비밀번호 미수집)' },
      { type: 'bullet', text: '[자동 수집] 앱 버전, 기기 OS, 서비스 이용 로그, 알림 수신 이력' },
      {
        type: 'note',
        text: '📌 ZDR 정책: 원시 WAV 음성 파일은 기기 내에서 특징벡터 추출 후 즉시 영구 삭제되며, 서버로 전송되지 않습니다. 서버에는 수치화된 특징벡터만 저장됩니다.',
      },
    ],
  },
  {
    id: 'article2',
    article: '제2조',
    title: '개인정보의 수집 및 이용 목적',
    content: [
      { type: 'body', text: '수집한 개인정보는 다음 목적으로만 이용되며, 목적 외 용도로 사용하지 않습니다.' },
      { type: 'bullet', text: '음성 바이오마커 기반 건강 변화 감지 및 경보 제공' },
      { type: 'bullet', text: '보호자에게 직접사용자의 건강 변화 트렌드 정보 제공' },
      { type: 'bullet', text: '월간 건강 리포트(참고용) 생성 및 제공' },
      { type: 'bullet', text: '이상 감지 시 보호자 푸시 알림 발송' },
      { type: 'bullet', text: '복약·병원 방문 리마인더 알림 발송' },
      { type: 'bullet', text: '서비스 이용 통계 분석 및 품질 개선' },
      { type: 'bullet', text: '회원 가입 및 가족 그룹 연동 관리' },
      { type: 'bullet', text: '소셜 로그인 인증 (보호자)' },
      {
        type: 'note',
        text: '본 서비스의 분석 결과는 "감지", "경보", "경향성"으로만 표현되며, "진단", "처방", "치료" 등 의료 용어를 사용하지 않습니다.',
      },
    ],
  },
  {
    id: 'article3',
    article: '제3조',
    title: '개인정보의 보유 및 이용 기간',
    content: [
      { type: 'bullet', text: '원시 WAV 음성 파일: 분석 완료 즉시 삭제 (서버 미저장)' },
      { type: 'bullet', text: '음성 바이오마커 특징벡터: 회원 탈퇴 시 즉시 삭제' },
      { type: 'bullet', text: '계정 정보(이름, 이메일 등): 회원 탈퇴 시 즉시 삭제' },
      { type: 'bullet', text: '생체정보 동의 이력 로그: 동의 철회 후 3년 (개인정보보호법)' },
      { type: 'bullet', text: '서비스 이용 로그: 서비스 종료 후 1년 (익명화 처리)' },
      { type: 'bullet', text: '서버 전송 실패 시 로컬 암호화 캐시: 최대 24시간 후 자동 삭제' },
    ],
  },
  {
    id: 'article4',
    article: '제4조',
    title: '개인정보의 제3자 제공 및 처리 위탁',
    content: [
      { type: 'subheading', text: '1. 제3자 제공' },
      { type: 'body', text: 'MOA는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 단, 다음의 경우는 예외입니다.' },
      { type: 'bullet', text: '직접사용자가 사전에 동의한 경우: 가족 그룹 내 보호자에게 건강 변화 트렌드 정보 제공' },
      { type: 'bullet', text: '법령에 의한 경우: 수사기관의 적법한 요청, 법원 명령 등' },
      {
        type: 'note',
        text: '가족 그룹 내 보호자 공유는 직접사용자의 사전 동의 하에만 이루어지며, 언제든지 연동 해제가 가능합니다.',
      },
      { type: 'subheading', text: '2. 처리 위탁' },
      { type: 'bullet', text: 'Supabase Inc. (미국): 데이터베이스 및 인증 서비스 운영' },
      { type: 'bullet', text: 'Google Firebase (미국): 푸시 알림 발송 서비스' },
      { type: 'bullet', text: '카카오(주): 카카오 소셜 로그인 인증' },
      { type: 'bullet', text: 'Google LLC: 구글 소셜 로그인 인증' },
      { type: 'bullet', text: '네이버(주): 네이버 소셜 로그인 인증' },
      { type: 'subheading', text: '3. 국외 이전' },
      { type: 'body', text: 'Supabase 및 Google Firebase 서비스 이용에 따라 일부 개인정보가 미국 서버에 저장·처리될 수 있습니다. (개인정보보호법 제28조의8에 따른 고지)' },
      { type: 'bullet', text: '미국 / Supabase Inc.: 계정 정보, 특징벡터 — DB 및 인증 서비스 — 표준 계약 조항(SCC)' },
      { type: 'bullet', text: '미국 / Google LLC: 기기 토큰, 알림 데이터 — 푸시 알림 서비스 — 표준 계약 조항(SCC)' },
    ],
  },
  {
    id: 'article5',
    article: '제5조',
    title: '정보주체의 권리와 행사 방법',
    content: [
      { type: 'body', text: '이용자는 MOA에 대해 언제든지 다음의 권리를 행사할 수 있습니다.' },
      { type: 'bullet', text: '열람권: 수집·보유 중인 개인정보 확인 요청 → 앱 내 설정에서 확인' },
      { type: 'bullet', text: '정정권: 오류 또는 변경된 정보의 수정 요청 → 앱 내 설정에서 수정' },
      { type: 'bullet', text: '삭제권: 보유 중인 개인정보 삭제 요청(탈퇴 포함) → 앱 내 계정 삭제' },
      { type: 'bullet', text: '처리정지권: 음성 분석 처리 중단 요청 → 앱 내 설정에서 음성 분석 일시 중지' },
      { type: 'bullet', text: '동의 철회권: 생체정보(음성) 수집·이용 동의 철회 → 앱 내 동의 관리' },
      { type: 'bullet', text: '이식권: 보유 데이터 이전 요청 → privacy@moa.app 이메일 요청' },
      {
        type: 'note',
        text: '생체정보(음성 바이오마커) 동의 철회 시, 음성 분석 기반 서비스 이용이 제한됩니다. 기 분석된 특징벡터는 즉시 삭제됩니다.',
      },
    ],
  },
  {
    id: 'article6',
    article: '제6조',
    title: '고령층 이용자 및 아동 보호',
    content: [
      { type: 'subheading', text: '1. 만 14세 미만 아동' },
      { type: 'body', text: 'MOA는 만 14세 미만 아동의 개인정보를 수집하지 않습니다.' },
      { type: 'subheading', text: '2. 고령층 이용자 보호' },
      { type: 'bullet', text: '온보딩 동의 화면은 최소 18pt 이상의 큰 글씨로 표시됩니다.' },
      { type: 'bullet', text: '개인정보 및 생체정보 동의는 보호자와 함께 진행하는 공동 동의 절차를 지원합니다.' },
      { type: 'bullet', text: '동의 내용은 전문 법률 용어 없이 쉬운 언어로 작성됩니다.' },
      { type: 'bullet', text: '직접사용자는 언제든지 보호자에 대한 정보 공유를 철회할 수 있습니다.' },
    ],
  },
  {
    id: 'article7',
    article: '제7조',
    title: '개인정보의 안전성 확보 조치',
    content: [
      { type: 'bullet', text: '전송 구간 HTTPS(TLS) 암호화 적용' },
      { type: 'bullet', text: '음성 특징벡터와 개인식별정보 물리적 분리 저장' },
      { type: 'bullet', text: '챗봇 대화 텍스트 비식별화 처리 후 별도 서버 보관' },
      { type: 'bullet', text: '원시 WAV 파일 분석 즉시 삭제 루틴 구현 (앱 강제종료 후 OS tmp 자동 정리)' },
      { type: 'bullet', text: '서버 전송 실패 시 로컬 암호화 캐시 최대 24시간 보관 후 자동 삭제' },
      { type: 'bullet', text: '가족 그룹 외부에서 직접사용자 데이터 접근 불가 (역할 기반 접근 제어)' },
      { type: 'bullet', text: '보호자 그룹 탈퇴 시 해당 보호자의 데이터 접근 즉시 차단' },
    ],
  },
  {
    id: 'article8',
    article: '제8조',
    title: '쿠키 및 자동 수집 장치',
    content: [
      { type: 'body', text: 'MOA 앱은 쿠키를 사용하지 않습니다. 단, 서비스 품질 개선을 위해 다음 정보를 자동으로 수집할 수 있습니다.' },
      { type: 'bullet', text: '기기 OS 버전 및 앱 버전' },
      { type: 'bullet', text: '서비스 이용 일시 및 체크인 이력' },
      { type: 'bullet', text: '앱 충돌 로그 (개인 식별 정보 미포함, 익명화 처리)' },
    ],
  },
  {
    id: 'article9',
    article: '제9조',
    title: '개인정보 보호책임자 및 문의처',
    content: [
      { type: 'bullet', text: '서비스명: MOA (모아)' },
      { type: 'bullet', text: '개인정보 보호책임자: MOA 팀' },
      { type: 'bullet', text: '이메일: privacy@moa.app' },
      { type: 'bullet', text: '처리 기간: 접수 후 10영업일 이내 답변' },
      { type: 'subheading', text: '개인정보 침해 신고·상담 기관' },
      { type: 'bullet', text: '개인정보보호위원회: privacy.go.kr / 국번 없이 182' },
      { type: 'bullet', text: '한국인터넷진흥원 개인정보침해신고센터: privacy.kisa.or.kr / 국번 없이 118' },
      { type: 'bullet', text: '경찰청 사이버수사국: ecrm.police.go.kr' },
      { type: 'bullet', text: '대검찰청 사이버수사과: www.spo.go.kr / 국번 없이 1301' },
    ],
  },
  {
    id: 'article10',
    article: '제10조',
    title: '개인정보처리방침의 변경',
    content: [
      { type: 'bullet', text: '본 방침은 2026년 7월 1일부터 시행됩니다.' },
      { type: 'bullet', text: '법령·서비스 변경에 따라 내용이 변경되는 경우, 앱 내 공지사항을 통해 사전 공지합니다.' },
      { type: 'bullet', text: '중요 변경 사항(수집 항목·이용 목적 변경 등)은 변경 7일 전, 그 외 변경은 1일 전 공지합니다.' },
      { type: 'bullet', text: '생체정보 처리 관련 중요 변경 시 별도 재동의를 받습니다.' },
    ],
  },
];
