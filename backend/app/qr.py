"""접수 QR 만들기 — 계약: ktl-hub docs/02-API명세.md §4 · docs/contracts/qr-test-vectors.json

Pi LCD에 띄우고 실험 PC(A-2)가 스캐너로 읽는다. 스캐너가 키보드처럼 입력하므로 문자열은 ASCII만 쓴다.

    {"v":1,"rn":"25-123456-01","sn":"FV-0001","ap":"ABCDE-2013-1","md":"FLOW-03D","rg":22,"cn":"7Jew7JWU6rO164yA","ck":"51cf3e4f"}

- 키 순서 고정: v, rn, sn, ap, md, rg, cn, ck · 공백 없는 JSON
- cn = 업체명 UTF-8 → Base64 URL-safe, '=' 제거
- ck = ck를 뺀 JSON의 SHA-256 앞 8자리 hex
"""
from __future__ import annotations

import base64
import hashlib
import json
import re
from dataclasses import dataclass

import segno

VERSION = 1
RECEIPT_RE = re.compile(r"^\d{2}-\d{6}-\d{2}$")   # 접수번호 NN-NNNNNN-NN


@dataclass(frozen=True)
class Receipt:
    """QR에 담는 값. 이름은 계약 키 대신 읽기 쉬운 말로."""
    receipt_no: str      # rn 접수번호
    serial: str          # sn 제조번호 (공백 가능)
    approval_no: str     # ap 형식승인번호
    model: str           # md 모델
    max_range: int | float  # rg 최대 측정범위 (m/s) — A-2 반복성 분모
    company: str         # cn 업체명 (Base64로 담김)


def encode_company(name: str) -> str:
    return base64.urlsafe_b64encode(name.encode("utf-8")).decode("ascii").rstrip("=")


def _dump(obj: dict) -> str:
    # 공백 없음 · ASCII만 · 키는 넣은 순서 그대로
    return json.dumps(obj, ensure_ascii=True, separators=(",", ":"))


def check_value(body: str) -> str:
    return hashlib.sha256(body.encode("ascii")).hexdigest()[:8]


def qr_text(r: Receipt) -> str:
    """접수 정보 → QR 문자열 (테스트 벡터와 글자 하나까지 같아야 한다)."""
    if not RECEIPT_RE.match(r.receipt_no):
        raise ValueError(f"접수번호 형식은 NN-NNNNNN-NN 입니다: {r.receipt_no!r}")
    if isinstance(r.max_range, bool) or not isinstance(r.max_range, (int, float)):
        raise ValueError("최대 측정범위(rg)는 숫자여야 합니다")
    body = {"v": VERSION, "rn": r.receipt_no, "sn": r.serial, "ap": r.approval_no, "md": r.model,
            "rg": r.max_range, "cn": encode_company(r.company)}
    return _dump({**body, "ck": check_value(_dump(body))})


def qr_svg(text: str, scale: int = 6) -> str:
    """LCD에 띄울 QR 그림 (SVG 문자열). 오류 정정 M — 화면 반사 · 스캐너 각도에 여유.
    벡터 크기 문자열은 QR 버전 8(49칸) → 테두리 포함 57칸 × 6 = 342px, 480px 화면에 글자 줄까지 들어간다."""
    q = segno.make(text, error="m", micro=False)
    return q.svg_inline(scale=scale, border=4, dark="#000", light="#fff")
