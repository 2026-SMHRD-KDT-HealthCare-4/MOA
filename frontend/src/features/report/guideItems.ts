// 목소리 건강 가이드 — 아코디언 섹션별 콘텐츠 데이터.
// 화면(VoiceGuidePage)에서 렌더링 로직과 분리해, 섹션 추가 시 이 파일만 확장하면 되도록 둔다.
// 특정 질환명·수치는 노출하지 않고, 관찰 문장 → 연구 참고 → 관련 진료과 영역만 안내한다.
export interface VoiceGuideItem {
  observation: string; // 1행: 관찰 문장
  reference: string;   // 2행: 관련 연구 참고(화살표는 화면에서 별도 렌더)
  department: string;  // 3행: 관련 진료과 영역(보조 정보, 회색/작은 폰트)
}

// 호흡과 발성 지속력
export const breathItems: VoiceGuideItem[] = [
  {
    observation: "\"아~\" 소리를 길게 유지하기 어려움",
    reference: "호흡 조절과 성대 근육 기능 연구에서 참고",
    department: "(신경과 · 이비인후과 영역에서 다뤄지는 변화예요)",
  },
  {
    observation: "목소리 크기가 매번 다르게 느껴짐",
    reference: "성대의 미세한 힘 조절 연구에서 참고",
    department: "(신경과 · 이비인후과 영역에서 다뤄지는 변화예요)",
  },
  {
    observation: "숨소리가 섞인 듯 거칠게 들림",
    reference: "성대 접촉과 호흡 기능 연구에서 참고",
    department: "(이비인후과 영역에서 다뤄지는 변화예요)",
  },
  {
    observation: "목소리의 느낌(음색)이 평소와 다르게 들림",
    reference: "발성 관련 신체 변화 연구에서 참고",
    department: "(이비인후과 · 내분비내과 영역에서 다뤄지는 변화예요)",
  },
  {
    observation: "목소리 높낮이 변화가 평소보다 적어짐",
    reference: "발성 조절 근육 기능 연구에서 참고",
    department: "(신경과 · 정신건강의학과 영역에서 다뤄지는 변화예요)",
  },
];

// 단어 선택과 말의 흐름
export const languageItems: VoiceGuideItem[] = [
  {
    observation: "말이 자주 끊기고 잠시 멈추는 시간이 길어짐",
    reference: "단어를 떠올리는 과정 연구에서 참고",
    department: "(신경과 · 정신건강의학과 영역에서 다뤄지는 변화예요)",
  },
  {
    observation: "말하는 속도가 평소보다 느려짐",
    reference: "말을 준비하고 표현하는 과정 연구에서 참고",
    department: "(신경과 · 정신건강의학과 영역에서 다뤄지는 변화예요)",
  },
  {
    observation: "방금 한 말을 다시 하거나 비슷한 표현을 반복함",
    reference: "언어 표현 패턴 연구에서 참고",
    department: "(신경과 영역에서 다뤄지는 변화예요)",
  },
  {
    observation: "\"그거\", \"이거\"처럼 구체적이지 않은 표현이 늘어남",
    reference: "단어 선택 과정 연구에서 참고",
    department: "(신경과 영역에서 다뤄지는 변화예요)",
  },
  {
    observation: "발음이 또렷하지 않고 웅얼거리듯 들림",
    reference: "입과 혀의 움직임 협응 연구에서 참고",
    department: "(신경과 영역에서 다뤄지는 변화예요)",
  },
];
