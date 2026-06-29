import re

MASK = "[MASK]"

# 1. 전화번호: 010-1234-5678, 02-123-4567, 01012345678 등
_PHONE_RE = re.compile(r"(?<!\d)0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)")

# 2. 생년월일: 1990-01-01, 1990.1.1, 1990년 1월 1일 등
_BIRTHDATE_RE = re.compile(r"(?:19|20)\d{2}[-./년]\s?\d{1,2}[-./월]\s?\d{1,2}일?")

# 3. 주소
_ADDRESS_RE = re.compile(
    r"[가-힣]{2,10}(?:특별시|광역시|도|시|군|구)\s?[가-힣0-9]{2,15}(?:동|로|길|읍|면)\s?[0-9\-]{1,10}(?:번지|호)?"
)

# 4. 경량 한글 이름 NER 정규식 (성씨 + 1~2자 한글 이름 조합 + 조사/호칭 접미)
_NAME_NER_RE = re.compile(
    r"\b([김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허][가-힣]{1,2})(?:님|씨|군|양|옹|이?가|은?는|을?를|이?네|에게|한테|와?과|의)\b"
)


def deidentify(text: str, target_names: list[str] | None = None) -> str:
    """대화 텍스트에서 생년월일/주소/전화번호 및 실명(NER 적용)을 [MASK] 로 치환한다."""
    if not text:
        return text

    masked = text

    # (1) 타겟 실명 리스트 기반 선제 1:1 마스킹 (토큰/데이터 결합 방어)
    if target_names:
        for name in target_names:
            if len(name) >= 2:
                masked = masked.replace(name, MASK)

    # (2) 경량 NER 정규식 마스킹 (문맥 호칭 및 조사 패턴 포착)
    def name_replacer(match):
        name_part = match.group(1)
        full_match = match.group(0)
        return full_match.replace(name_part, MASK, 1)

    masked = _NAME_NER_RE.sub(name_replacer, masked)

    # (3) 기존 전화번호/생년월일/주소 마스킹
    masked = _PHONE_RE.sub(MASK, masked)
    masked = _BIRTHDATE_RE.sub(MASK, masked)
    masked = _ADDRESS_RE.sub(MASK, masked)

    return masked
