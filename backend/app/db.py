"""SQLite(WAL) 연결 · 마이그레이션. 전원이 갑자기 꺼져도 DB가 깨지지 않게 WAL + synchronous=FULL (REQ-A1-09).

DB 위치: 환경변수 PI_DB (기본 backend/data/pi.db — git에 올리지 않는다)
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

BACKEND = Path(__file__).resolve().parents[1]


def db_path() -> Path:
    return Path(os.environ.get("PI_DB") or BACKEND / "data" / "pi.db")


def make_engine(path: Path | str | None = None) -> Engine:
    p = Path(path) if path else db_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    eng = create_engine(f"sqlite:///{p.as_posix()}", future=True)

    @event.listens_for(eng, "connect")
    def _pragmas(dbapi_conn, _):  # noqa: ANN001
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=FULL")
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    return eng


_engine: Engine | None = None
_Session: sessionmaker[Session] | None = None


def engine() -> Engine:
    global _engine, _Session
    if _engine is None:
        _engine = make_engine()
        _Session = sessionmaker(_engine, expire_on_commit=False)
    return _engine


@contextmanager
def session() -> Iterator[Session]:
    engine()
    assert _Session is not None
    s = _Session()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()


def upgrade(path: Path | str | None = None) -> None:
    """Alembic 마이그레이션을 끝까지 적용한다 (서버 시작 때 자동)."""
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{Path(path or db_path()).as_posix()}")
    Path(path or db_path()).parent.mkdir(parents=True, exist_ok=True)
    command.upgrade(cfg, "head")
