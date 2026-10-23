"""QR 계약 테스트. 벡터는 ktl-hub docs/contracts/qr-test-vectors.json 을 그대로 복사한 것 (고치지 말 것)."""
import json
from pathlib import Path

import pytest

from app.qr import Receipt, check_value, encode_company, qr_svg, qr_text

VECTORS = json.loads((Path(__file__).parent / "fixtures" / "qr-test-vectors.json").read_text(encoding="utf-8"))["vectors"]
VALID = [v for v in VECTORS if v["valid"]]


def _receipt(inp: dict) -> Receipt:
    return Receipt(receipt_no=inp["rn"], serial=inp["sn"], approval_no=inp["ap"], model=inp["md"],
                   max_range=inp["rg"], company=inp["company"])


def test_vectors_present():
    assert len(VALID) == 3


@pytest.mark.parametrize("v", VALID, ids=[v["input"]["sn"] for v in VALID])
def test_valid_vectors_match_exactly(v):
    assert qr_text(_receipt(v["input"])) == v["qr"]


@pytest.mark.parametrize("v", VALID, ids=[v["input"]["sn"] for v in VALID])
def test_check_value_source(v):
    assert check_value(v["ck_source"]) == json.loads(v["qr"])["ck"]


def test_qr_text_is_ascii_only():
    for v in VALID:
        qr_text(_receipt(v["input"])).encode("ascii")


def test_company_base64_has_no_padding():
    assert encode_company("연암공대") == "7Jew7JWU6rO164yA"
    assert "=" not in encode_company("가나다테크(주)")


@pytest.mark.parametrize("bad", ["25-12345-01", "2512345601", "25-123456-1", ""])
def test_rejects_bad_receipt_no(bad):
    inp = {**VALID[0]["input"], "rn": bad}
    with pytest.raises(ValueError):
        qr_text(_receipt(inp))


def test_svg_renders():
    svg = qr_svg(VALID[0]["qr"])
    assert svg.startswith("<svg") and "</svg>" in svg
