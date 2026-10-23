"""검색용 정규화 — ㈜ · (주) · 주식회사 · 공백 · 기호 · 대소문자 차이를 없앤다 (REQ-A1-01).

    normalize("가나다테크(주)") == normalize("㈜ 가나다 테크") == "가나다테크"
"""
from __future__ import annotations

import re
import unicodedata

# 회사 형태 표기 (앞뒤 어디에 붙어도 뺀다). 영문은 단어 경계로만 — Incheon의 inc 같은 것을 지우지 않게
_CORP = re.compile(r"㈜|\(주\)|\(유\)|\(사\)|\(재\)|주식회사|유한회사|\bco\b\.?,?\s*\bltd\b\.?|\binc\b\.?|\bcorp\b\.?", re.IGNORECASE)
_KEEP = re.compile(r"[^0-9a-z가-힣]")


def normalize(s: str | None) -> str:
    if not s:
        return ""
    s = s.replace("㈜", "(주)")             # NFKC가 ㈜를 (주)로 풀지만 확실히
    s = unicodedata.normalize("NFKC", s)   # 전각 문자 · 합자를 풀어 둔다
    s = s.lower()
    s = _CORP.sub("", s)
    return _KEEP.sub("", s)
