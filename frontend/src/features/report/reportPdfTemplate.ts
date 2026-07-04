// 보호자 리포트 PDF용 HTML 템플릿 생성기 (expo-print printToFileAsync 에 전달).
// 규칙: 색상은 tokens.ts 토큰만 사용(하드코딩 금지), 레드 금지·경고색은 앰버(#E8943A)만.
//       "진단/처방/치료" 금지 → "감지/경향/참고용". "어르신/senior" 금지 → "직접사용자".
//       음성 영역은 수치·퍼센트·질환명 없이 정성 문구만 노출한다.
import { colors } from "../../styles/tokens";

const NAVY = colors.guardianNavy;
const G = colors.guardian;

// PDF 팔레트 — tokens 팔레트만 조합(신규 색상 추가 없음). 세이지그린 토큰이 없어
// '정상'은 네이비(정보 톤), '주의'는 앰버로 구분한다(레드 미사용).
const PDF = {
  pageBg: G.bgPage, // #FCF8F3
  cardBg: G.card, // #FFFFFF
  softBg: G.cardPeach, // #FDECDD
  heading: NAVY.primary, // #173F73
  text: G.textPrimary, // #4A4A48
  sub: G.textSecondary, // #8A8A86
  border: NAVY.border, // rgba(94,65,40,0.12)
  amber: G.amber, // #E8943A (유일한 경고색)
  normal: NAVY.primary, // 정상 상태 강조(네이비)
};

export interface ReportPdfMedication {
  name: string;
  times: string[]; // 'HH:MM'
}

export interface ReportPdfProps {
  elderlyName: string;
  periodLabel: string; // 예: "2026.07.01 ~ 2026.07.31"
  createdLabel: string; // 예: "2026.07.02"
  // 기본정보
  gender?: string; // "남성" | "여성"
  birthDate?: string; // "YYYY-MM-DD"
  smoking?: string; // "흡연" | "비흡연"
  bmi?: string; // 예: "22.5"
  guardianPhone?: string;
  // 이번 달 주목할 변화 (report.voicePatterns 재사용 — 정성 문구만)
  voicePatterns: { area: string; status: "normal" | "caution"; text: string }[];
  // 복약 현황
  currentMeds: ReportPdfMedication[];
  pastMeds: ReportPdfMedication[];
  // 측정 참여율
  participation: { done: number; total: number };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 복약 스케줄 표기: "매일 N회" (매일 주기 기준, 시간 비노출). 순응도는 표시하지 않는다.
function medScheduleLabel(times: string[]): string {
  if (times.length === 0) return "매일";
  return `매일 ${times.length}회`;
}

function medRows(meds: ReportPdfMedication[]): string {
  if (meds.length === 0) {
    return `<p class="empty">기록된 이력이 없어요</p>`;
  }
  return `<ul class="medlist">${meds
    .map(
      (m) =>
        `<li><span class="medname">${escapeHtml(m.name)}</span>` +
        `<span class="medtimes">${escapeHtml(medScheduleLabel(m.times))}</span></li>`,
    )
    .join("")}</ul>`;
}

function patternRows(
  patterns: ReportPdfProps["voicePatterns"],
): string {
  if (patterns.length === 0) {
    return `<p class="empty">목소리 패턴 분석을 준비 중이에요</p>`;
  }
  return patterns
    .map((p) => {
      const caution = p.status === "caution";
      const accent = caution ? PDF.amber : PDF.normal;
      const label = caution ? "변화 감지" : "안정";
      return `<div class="pattern" style="border-left:4px solid ${accent}">
        <div class="pattern-head">
          <span class="pattern-area">${escapeHtml(p.area)}</span>
          <span class="pattern-badge" style="color:${accent}">${label}</span>
        </div>
        <div class="pattern-text">${escapeHtml(p.text)}</div>
      </div>`;
    })
    .join("");
}

// props → 완성된 HTML 문자열. expo-print 는 이 문자열을 그대로 렌더링한다.
export function buildReportHtml(props: ReportPdfProps): string {
  const {
    elderlyName,
    periodLabel,
    createdLabel,
    gender,
    birthDate,
    smoking,
    bmi,
    guardianPhone,
    voicePatterns,
    currentMeds,
    pastMeds,
    participation,
  } = props;

  const name = escapeHtml(elderlyName || "직접사용자");
  const infoRow = (label: string, value?: string) =>
    `<tr><th>${label}</th><td>${value ? escapeHtml(value) : "정보없음"}</td></tr>`;

  const participationText =
    participation.total > 0
      ? `이번 달 ${participation.total}일 중 ${participation.done}일 참여했어요`
      : "아직 측정 기록이 쌓이지 않았어요";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=794, initial-scale=1" />
<style>
  /* 용지를 A4로 고정한다. 여백은 .sheet 패딩으로 주므로 페이지 여백은 0. */
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: ${PDF.pageBg};
    color: ${PDF.text};
    font-family: -apple-system, "Noto Sans KR", "Malgun Gothic", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* 기기 뷰포트와 무관하게 A4(210mm) 물리 폭으로 고정 → 모든 기기에서 1:1로 인쇄된다. */
  .sheet {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 16mm 14mm 18mm;
    background: ${PDF.pageBg};
  }
  /* 화면에서 열렸을 때만(인쇄 아님) 종이처럼 보이도록 배경만 회색으로. 인쇄엔 영향 없음. */
  @media screen {
    html, body { background: #d9d9d9; }
    .sheet { box-shadow: 0 2px 12px rgba(0,0,0,0.18); }
  }
  .header { border-bottom: 3px solid ${PDF.heading}; padding-bottom: 14px; margin-bottom: 22px; }
  .brand { font-size: 13px; font-weight: 700; color: ${PDF.amber}; letter-spacing: 2px; }
  .title { font-size: 24px; font-weight: 800; color: ${PDF.heading}; margin: 6px 0 2px; }
  .period { font-size: 13px; color: ${PDF.sub}; }
  section { margin-bottom: 22px; }
  h2 {
    font-size: 15px; font-weight: 800; color: ${PDF.heading};
    margin: 0 0 10px; padding-left: 10px; border-left: 4px solid ${PDF.amber};
  }
  .card { background: ${PDF.cardBg}; border: 1px solid ${PDF.border}; border-radius: 12px; padding: 14px 16px; }
  table.info { width: 100%; border-collapse: collapse; }
  table.info th, table.info td { text-align: left; padding: 6px 0; font-size: 13px; vertical-align: top; }
  table.info th { width: 120px; color: ${PDF.sub}; font-weight: 600; }
  table.info td { color: ${PDF.text}; font-weight: 600; }
  .pattern { background: ${PDF.cardBg}; border: 1px solid ${PDF.border}; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; }
  .pattern-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .pattern-area { font-size: 14px; font-weight: 800; color: ${PDF.text}; }
  .pattern-badge { font-size: 12px; font-weight: 700; }
  .pattern-text { font-size: 13px; color: ${PDF.sub}; line-height: 1.5; }
  .subhead { font-size: 13px; font-weight: 700; color: ${PDF.heading}; margin: 8px 0 6px; }
  ul.medlist { list-style: none; margin: 0 0 4px; padding: 0; }
  ul.medlist li { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid ${PDF.border}; font-size: 13px; }
  ul.medlist li:last-child { border-bottom: none; }
  .medname { font-weight: 700; color: ${PDF.text}; }
  .medtimes { color: ${PDF.sub}; }
  .empty { font-size: 13px; color: ${PDF.sub}; margin: 6px 0; }
  .participation { font-size: 15px; font-weight: 700; color: ${PDF.heading}; }
  .disclaimer {
    margin-top: 28px; padding: 14px 16px; border-radius: 10px;
    background: ${PDF.softBg}; color: ${PDF.text};
    font-size: 12px; line-height: 1.6;
  }
  .footmeta { margin-top: 12px; font-size: 11px; color: ${PDF.sub}; text-align: right; }
</style>
</head>
<body>
<div class="sheet">
  <div class="header">
    <div class="brand">MOA REPORT</div>
    <div class="title">${name} 님 건강 리포트</div>
    <div class="period">${escapeHtml(periodLabel)}</div>
  </div>

  <section>
    <h2>기본정보</h2>
    <div class="card">
      <table class="info">
        ${infoRow("이름", elderlyName)}
        ${infoRow("성별", gender)}
        ${infoRow("생년월일", birthDate)}
        ${infoRow("흡연 여부", smoking)}
        ${infoRow("BMI", bmi)}
        ${infoRow("보호자 연락처", guardianPhone)}
      </table>
    </div>
  </section>

  <section>
    <h2>이번 달 주목할 변화</h2>
    ${patternRows(voicePatterns)}
  </section>

  <section>
    <h2>복약 현황</h2>
    <div class="card">
      <div class="subhead">현재 복용 중</div>
      ${medRows(currentMeds)}
      <div class="subhead" style="margin-top:12px">과거 복용했던 약</div>
      ${medRows(pastMeds)}
    </div>
  </section>

  <section>
    <h2>측정 참여율</h2>
    <div class="card">
      <div class="participation">${participationText}</div>
    </div>
  </section>

  <div class="disclaimer">
    이 리포트는 의학적 진단·처방이 아닌 음성 기반 건강 경향성 참고 자료이며,
    정확한 진단은 전문 의료기관에서 받으시기 바랍니다.
  </div>
  <div class="footmeta">생성일 ${escapeHtml(createdLabel)}</div>
</div>
</body>
</html>`;
}
