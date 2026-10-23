import shutil

import pytest

from app import db

SYNTHETIC = db.BACKEND.parent / "synthetic" / "devices.csv"


def _use(path, monkeypatch):
    monkeypatch.setenv("PI_DB", str(path))
    monkeypatch.setattr(db, "_engine", None)
    monkeypatch.setattr(db, "_Session", None)


@pytest.fixture(scope="session")
def _templates(tmp_path_factory):
    """마이그레이션한 빈 DB와 가짜 20대를 넣은 DB를 한 번만 만들어 두고 테스트마다 복사한다 (빠르게)."""
    from app.seed import load_csv

    d = tmp_path_factory.mktemp("tpl")
    empty, seeded = d / "empty.db", d / "seeded.db"
    db.upgrade(empty)
    shutil.copy(empty, seeded)
    mp = pytest.MonkeyPatch()
    _use(seeded, mp)
    load_csv(SYNTHETIC)
    db._engine.dispose()
    mp.undo()
    db._engine = db._Session = None
    return empty, seeded


def _copy(src, tmp_path, monkeypatch):
    path = tmp_path / "pi.db"
    shutil.copy(src, path)
    _use(path, monkeypatch)
    yield path
    if db._engine is not None:
        db._engine.dispose()


@pytest.fixture()
def fresh_db(_templates, tmp_path, monkeypatch):
    """빈 DB (마이그레이션 적용됨). 실제 data/pi.db는 건드리지 않는다."""
    yield from _copy(_templates[0], tmp_path, monkeypatch)


@pytest.fixture()
def seeded_db(_templates, tmp_path, monkeypatch):
    """가짜 기기 20대가 들어 있는 DB."""
    yield from _copy(_templates[1], tmp_path, monkeypatch)
