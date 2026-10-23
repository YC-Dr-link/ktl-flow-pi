"""기기 CSV 불러오기 (synthetic/devices.csv 형식). 같은 업체 · 제조번호는 덮어쓰고 새로 만들지 않는다.

    python -m app.seed ../synthetic/devices.csv
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import db
from .models import Approval, Company, CompanyAlias, Device, PitotTube
from .text import normalize

COLUMNS = ["company", "aliases", "model", "serial", "approval_no", "max_range", "range_min", "last_receipt_no", "pitot_serial"]


def _company(s: Session, name: str) -> Company:
    norm = normalize(name)
    c = s.scalar(select(Company).where(Company.norm == norm))
    if not c:
        c = Company(name=name.strip(), norm=norm)
        s.add(c)
        s.flush()
    return c


def _alias(s: Session, c: Company, alias: str) -> None:
    norm = normalize(alias)
    if norm and norm != c.norm and not s.scalar(select(CompanyAlias).where(CompanyAlias.company_id == c.id, CompanyAlias.norm == norm)):
        s.add(CompanyAlias(company_id=c.id, alias=alias.strip(), norm=norm))


def load_rows(s: Session, rows: list[dict]) -> int:
    n = 0
    for r in rows:
        c = _company(s, r["company"])
        for a in filter(None, (x.strip() for x in (r.get("aliases") or "").split(";"))):
            _alias(s, c, a)
        ap_no = (r.get("approval_no") or "").strip() or None
        max_range = float(r["max_range"])
        if ap_no and not s.get(Approval, ap_no):
            s.add(Approval(approval_no=ap_no, model=r["model"].strip(), range_max=max_range,
                           range_min=float(r["range_min"]) if r.get("range_min") else None))
        serial_norm = normalize(r["serial"])
        d = s.scalar(select(Device).where(Device.company_id == c.id, Device.serial_norm == serial_norm))
        if not d:
            d = Device(company_id=c.id, serial=r["serial"].strip(), serial_norm=serial_norm, model="", max_range=0)
            s.add(d)
        d.model = r["model"].strip()
        d.approval_no = ap_no
        d.max_range = max_range
        d.last_receipt_no = (r.get("last_receipt_no") or "").strip() or None
        s.flush()
        pitot = (r.get("pitot_serial") or "").strip()
        if pitot and not any(p.serial == pitot for p in d.pitots):
            d.pitots.append(PitotTube(serial=pitot))
        n += 1
    return n


def load_csv(path: Path | str) -> int:
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        missing = set(COLUMNS) - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV에 없는 칸: {', '.join(sorted(missing))}")
        rows = list(reader)
    with db.session() as s:
        return load_rows(s, rows)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("사용법: python -m app.seed <devices.csv>")
    db.upgrade()
    print(f"{load_csv(sys.argv[1])}대 불러옴 → {db.db_path()}")
