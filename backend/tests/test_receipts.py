import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.qr import check_value


@pytest.fixture()
def client(seeded_db):
    return TestClient(app)


def device_id(client, serial, company=None):
    rows = client.get("/api/devices", params={"q": serial}).json()
    return next(r["id"] for r in rows if r["serial"] == serial and (company is None or r["company"] == company))


def test_device_detail(client):
    d = client.get(f"/api/devices/{device_id(client, 'FV-0001')}").json()
    assert d["company"] == "㈜라마바계측" and d["model"] == "FLOW-03D" and d["approval_no"] == "ABCDE-2013-1"
    assert d["max_range"] == 22 and d["last_receipt_no"] == "25-123456-01" and d["pitots"] == ["PT-F0001"]


def test_unknown_device_404(client):
    assert client.get("/api/devices/9999").status_code == 404


def test_receipt_makes_contract_qr(client):
    """테스트 벡터 1과 같은 기기 · 접수번호(업체명만 다름) → 계약 형식 그대로, ck가 맞는다."""
    r = client.post("/api/receipts", json={"device_id": device_id(client, "FV-0001"), "receipt_no": "25-123456-01"})
    assert r.status_code == 201
    body = r.json()
    q = json.loads(body["qr_text"])
    assert list(q) == ["v", "rn", "sn", "ap", "md", "rg", "cn", "ck"]
    assert q["rg"] == 22 and '"rg":22,' in body["qr_text"]          # 정수는 22.0이 아니라 22
    src = body["qr_text"].rsplit(',"ck":', 1)[0] + "}"
    assert q["ck"] == check_value(src)
    assert body["qr_svg"].startswith("<svg")


def test_receipt_number_format_rejected(client):
    did = device_id(client, "FV-0001")
    for bad in ["25-12345-01", "251234560", "", "가-123456-01"]:
        r = client.post("/api/receipts", json={"device_id": did, "receipt_no": bad})
        assert r.status_code == 400
        assert r.json()["detail"] == "접수번호 형식은 26-000123-01 입니다"


def test_last_receipt_updates_after_new_receipt(client):
    did = device_id(client, "FV-0002")
    client.post("/api/receipts", json={"device_id": did, "receipt_no": "26-000201-01"})
    assert client.get(f"/api/devices/{did}").json()["last_receipt_no"] == "26-000201-01"


def test_qr_image_decodes_back_to_text(client):
    """실험 PC 스캐너 대신: 만든 QR 그림을 디코더로 다시 읽어 원문과 같은지 (REQ-A1-03 '스캐너로 읽힘')."""
    cv2 = pytest.importorskip("cv2")
    np = pytest.importorskip("numpy")
    import io

    import segno

    text = client.post("/api/receipts", json={"device_id": device_id(client, "SN 55/7"), "receipt_no": "26-000202-01"}).json()["qr_text"]
    buf = io.BytesIO()
    segno.make(text, error="m", micro=False).save(buf, kind="png", scale=6, border=4)   # 화면과 같은 배율
    img = cv2.imdecode(np.frombuffer(buf.getvalue(), np.uint8), cv2.IMREAD_GRAYSCALE)
    decoded, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
    assert decoded == text
