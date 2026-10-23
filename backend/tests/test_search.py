import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client(seeded_db):
    return TestClient(app)


def find(client, q):
    r = client.get("/api/devices", params={"q": q})
    assert r.status_code == 200
    return r.json()


@pytest.mark.parametrize("q", ["가나다", "가나다테크(주)", "㈜가나다테크", "가나다 테크", "GND tech", "gnd TECH"])
def test_company_name_and_alias_forms_find_same_devices(client, q):
    rows = find(client, q)
    assert {r["serial"] for r in rows} == {"A100-0007", "A100-0011", "A200-0003", "A200-0019"}
    assert all(r["company"] == "가나다테크(주)" for r in rows)


def test_serial_search_ignores_spaces_and_symbols(client):
    assert [r["serial"] for r in find(client, "sn 55 7")] == ["SN 55/7"]
    assert [r["serial"] for r in find(client, "SN55/7")] == ["SN 55/7"]


def test_same_serial_in_two_companies_shows_both(client):
    rows = find(client, "A100-0007")
    assert {r["company"] for r in rows} == {"가나다테크(주)", "차카타환경(주)"}
    assert all(r["serial"] == "A100-0007" for r in rows)


def test_exact_serial_comes_first(client):
    rows = find(client, "FV-0001")
    assert rows[0]["serial"] == "FV-0001"


def test_alias_in_english(client):
    assert len(find(client, "RMB Instruments")) == 3


def test_short_or_empty_query_returns_nothing(client):
    assert find(client, "가") == []
    assert find(client, " ") == []
    assert find(client, "(주)") == []     # 회사 형태만 쓰면 아무것도 안 남는다


def test_no_result(client):
    assert find(client, "없는업체") == []
