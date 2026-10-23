import pytest

from app import db

SYNTHETIC = db.BACKEND.parent / "synthetic" / "devices.csv"


@pytest.fixture()
def fresh_db(tmp_path, monkeypatch):
    """테스트마다 빈 DB (마이그레이션 적용됨). 실제 data/pi.db는 건드리지 않는다."""
    path = tmp_path / "pi.db"
    monkeypatch.setenv("PI_DB", str(path))
    monkeypatch.setattr(db, "_engine", None)
    monkeypatch.setattr(db, "_Session", None)
    db.upgrade(path)
    yield path
    if db._engine is not None:
        db._engine.dispose()
