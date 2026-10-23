from sqlalchemy import func, select, text

from app import db
from app.models import Approval, Company, CompanyAlias, Device, PitotTube
from app.seed import load_csv
from app.text import normalize

SYNTHETIC = db.BACKEND.parent / "synthetic" / "devices.csv"


def test_migration_creates_tables(fresh_db):
    with db.engine().connect() as c:
        names = {r[0] for r in c.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))}
    assert {"companies", "company_aliases", "approvals", "devices", "pitot_tubes", "receipts", "alembic_version"} <= names


def test_wal_mode(fresh_db):
    with db.engine().connect() as c:
        assert c.execute(text("PRAGMA journal_mode")).scalar() == "wal"
        assert c.execute(text("PRAGMA foreign_keys")).scalar() == 1


def test_seed_synthetic_20_devices(fresh_db):
    assert load_csv(SYNTHETIC) == 20
    with db.session() as s:
        assert s.scalar(select(func.count()).select_from(Device)) == 20
        assert s.scalar(select(func.count()).select_from(Company)) == 6
        assert s.scalar(select(func.count()).select_from(Approval)) >= 6
        assert s.scalar(select(func.count()).select_from(CompanyAlias)) > 0
        assert s.scalar(select(func.count()).select_from(PitotTube)) == 14


def test_seed_twice_does_not_duplicate(fresh_db):
    load_csv(SYNTHETIC)
    load_csv(SYNTHETIC)
    with db.session() as s:
        assert s.scalar(select(func.count()).select_from(Device)) == 20
        assert s.scalar(select(func.count()).select_from(PitotTube)) == 14


def test_same_serial_in_two_companies(fresh_db):
    load_csv(SYNTHETIC)
    with db.session() as s:
        rows = s.scalars(select(Device).where(Device.serial_norm == normalize("A100-0007"))).all()
        assert len({d.company_id for d in rows}) == 2


def test_normalize_company_forms():
    assert normalize("가나다테크(주)") == normalize("㈜가나다테크") == normalize("가나다 테크") == "가나다테크"
    assert normalize("주식회사 라마바계측") == normalize("㈜라마바계측") == "라마바계측"
    assert normalize("Sample Flow Co. Ltd.") == normalize("sample flow") == "sampleflow"
    assert normalize("SN 55/7") == "sn557"
    assert normalize("") == normalize(None) == ""


def test_normalize_keeps_words_containing_inc():
    assert normalize("Incheon Flow") == "incheonflow"
