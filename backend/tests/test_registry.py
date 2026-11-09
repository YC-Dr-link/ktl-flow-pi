"""PI-06 기기 등록 · 수정 (REQ-A1-04 "등록 후 바로 검색됨") + 업체 찾기 · 기준정보 · 요약."""
import json

import pytest
from fastapi.testclient import TestClient

from app.main import app

NEW = {
    "company": "마바사정밀(주)", "aliases": ["㈜마바사정밀", "MBS Precision"], "model": "FM-300", "serial": "MB-0001",
    "approval_no": "ABCD-2024-5", "max_range": 30, "range_min": 0.5, "last_receipt_no": "25-000301-01", "pitots": ["PT-M0001"],
}


@pytest.fixture()
def client(seeded_db):
    return TestClient(app)


def find(client, q):
    return client.get("/api/devices", params={"q": q}).json()


def device_id(client, serial, company=None):
    return next(r["id"] for r in find(client, serial) if r["serial"] == serial and (company is None or r["company"] == company))


def create(client, **over):
    return client.post("/api/devices", json={**NEW, **over})


def test_create_then_searchable_right_away(client):
    r = create(client)
    assert r.status_code == 201
    d = r.json()
    assert d["company"] == "마바사정밀(주)" and d["serial"] == "MB-0001" and d["approval_no"] == "ABCD-2024-5"
    assert d["max_range"] == 30 and d["range_min"] == 0.5 and d["pitots"] == ["PT-M0001"]
    assert d["aliases"] == ["MBS Precision"]          # ㈜마바사정밀은 정규화하면 업체명과 같아서 따로 안 남긴다
    for q in ["마바사", "MBS precision", "mb0001", "MB-0001"]:
        assert [x["id"] for x in find(client, q)] == [d["id"]], q


def test_new_device_makes_contract_qr(client):
    did = create(client).json()["id"]
    r = client.post("/api/receipts", json={"device_id": did, "receipt_no": "26-000301-01"})
    assert r.status_code == 201
    q = json.loads(r.json()["qr_text"])
    assert q["sn"] == "MB-0001" and q["ap"] == "ABCD-2024-5" and q["rg"] == 30


def test_create_into_existing_company_by_alias(client):
    """업체를 별칭(GND Tech)으로 써도 새 업체를 만들지 않고 기존 가나다테크(주)에 붙는다."""
    d = create(client, company="GND Tech", serial="A300-0001", aliases=[]).json()
    assert d["company"] == "가나다테크(주)" and d["company_devices"] == 5


def test_duplicate_serial_in_same_company_is_409(client):
    r = create(client, company="㈜가나다테크", serial="a100 0007")
    assert r.status_code == 409
    assert "A100-0007" in r.json()["detail"]


def test_same_serial_other_company_is_fine(client):
    assert create(client, serial="A100-0007").status_code == 201


@pytest.mark.parametrize("over, msg", [
    ({"company": "  "}, "업체명"),
    ({"company": "(주)"}, "업체명"),
    ({"model": ""}, "모델"),
    ({"serial": "--"}, "제조번호"),
    ({"approval_no": ""}, "형식승인번호"),
    ({"max_range": 0}, "최대 측정범위"),
    ({"max_range": 500}, "최대 측정범위"),
    ({"range_min": 40}, "최소 측정범위"),
    ({"last_receipt_no": "25-12345-01"}, "작년 접수번호"),
    ({"max_range": "빠름"}, "최대 측정범위"),
    ({"pitots": ["P1", "P2", "P3", "P4", "P5", "P6"]}, "피토관"),
])
def test_create_validation_messages_in_korean(client, over, msg):
    r = create(client, **over)
    assert r.status_code == 400
    assert msg in r.json()["detail"]


def test_approval_no_is_tidied(client):
    d = create(client, approval_no=" abcd-2024-5 ").json()
    assert d["approval_no"] == "ABCD-2024-5"


def test_patch_changes_fields_and_records_history(client):
    did = device_id(client, "FV-0002")
    r = client.patch(f"/api/devices/{did}", json={"reason": "오타 수정", "model": "FLOW-03E", "max_range": 25, "pitots": ["PT-F0002", "PT-F0099"]})
    assert r.status_code == 200
    d = r.json()
    assert d["model"] == "FLOW-03E" and d["max_range"] == 25 and d["pitots"] == ["PT-F0002", "PT-F0099"] and d["edits"] == 1
    h = client.get(f"/api/devices/{did}/history").json()
    assert h[0]["action"] == "update" and h[0]["reason"] == "오타 수정"
    assert h[0]["changes"]["model"] == ["FLOW-03D", "FLOW-03E"] and "serial" not in h[0]["changes"]


def test_patch_requires_reason(client):
    did = device_id(client, "FV-0002")
    r = client.patch(f"/api/devices/{did}", json={"reason": " ", "model": "X"})
    assert r.status_code == 400 and "수정 사유" in r.json()["detail"]
    r = client.patch(f"/api/devices/{did}", json={"model": "X"})
    assert r.status_code == 400 and "수정 사유" in r.json()["detail"]


def test_rename_company_keeps_old_name_searchable(client):
    """업체명이 바뀜 → 그 업체 기기 모두 새 이름, 예전 이름은 별칭으로 남아 계속 검색된다."""
    did = device_id(client, "PH-0101")
    d = client.patch(f"/api/devices/{did}", json={"reason": "업체명 변경", "company": "파하계측(주)"}).json()
    assert d["company"] == "파하계측(주)" and "파하측정" in d["aliases"]
    assert {r["company"] for r in find(client, "파하측정")} == {"파하계측(주)"}
    assert len(find(client, "파하계측")) == 3


def test_move_device_to_other_existing_company(client):
    did = device_id(client, "SF1-0002")
    d = client.patch(f"/api/devices/{did}", json={"reason": "업체 정정", "company": "샘플플로우"}).json()
    assert d["company"] == "Sample Flow Co. Ltd."     # 별칭으로 같은 업체 → 그대로
    d = client.patch(f"/api/devices/{did}", json={"reason": "업체 정정", "company": "㈜라마바계측"}).json()
    assert d["company"] == "㈜라마바계측" and d["company_devices"] == 4


def test_patch_serial_conflict_is_409(client):
    did = device_id(client, "FV-0002")
    r = client.patch(f"/api/devices/{did}", json={"reason": "오타", "serial": "FV 0001"})
    assert r.status_code == 409


def test_patch_clear_last_receipt(client):
    did = device_id(client, "FV-0002")
    assert client.patch(f"/api/devices/{did}", json={"reason": "정정", "last_receipt_no": ""}).json()["last_receipt_no"] is None


def test_patch_unknown_device_404(client):
    assert client.patch("/api/devices/9999", json={"reason": "x", "model": "y"}).status_code == 404


def test_create_history(client):
    did = create(client).json()["id"]
    h = client.get(f"/api/devices/{did}/history").json()
    assert len(h) == 1 and h[0]["action"] == "create" and h[0]["changes"]["serial"] == [None, "MB-0001"]


def test_companies_lookup(client):
    rows = client.get("/api/companies", params={"q": "gnd"}).json()
    assert [r["name"] for r in rows] == ["가나다테크(주)"] and rows[0]["devices"] == 4
    assert len(client.get("/api/companies").json()) == 6


def test_all_devices_list(client):
    assert find(client, "") == []
    assert len(client.get("/api/devices", params={"all": "true"}).json()) == 20


def test_spec_and_stats(client):
    sp = client.get("/api/specs/ABCDE-2013-1").json()
    assert sp["range_max"] == 22 and sp["range_min"] == 0.3 and sp["devices"] == 4
    assert client.get("/api/specs/NOPE").status_code == 404
    st = client.get("/api/stats").json()
    assert st["devices"] == 20 and st["companies"] == 6 and st["receipts_today"] == 0
