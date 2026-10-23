"""기기 검색 API (PI-01, REQ-A1-01). Pi 안에서만 쓰는 127.0.0.1:8000/api — 02 §6 참고용."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload

from . import db
from .models import Company, CompanyAlias, Device
from .text import normalize

router = APIRouter(prefix="/api")
MIN_QUERY = 2      # 2글자부터 검색 (03 시나리오 A-1)
LIMIT = 30


class DeviceRow(BaseModel):
    id: int
    company: str
    model: str
    serial: str
    last_receipt_no: str | None


@router.get("/devices", response_model=list[DeviceRow])
def search_devices(q: str = "") -> list[DeviceRow]:
    """업체명 · 업체 별칭 · 제조번호로 찾는다. ㈜/(주)/공백/대소문자 차이는 무시한다."""
    if len(q.strip()) < MIN_QUERY:
        return []
    qn = normalize(q)
    if not qn:
        return []
    like = f"%{qn}%"
    alias_hit = select(CompanyAlias.company_id).where(CompanyAlias.norm.like(like))
    with db.session() as s:
        rows = s.scalars(
            select(Device).join(Company).options(joinedload(Device.company))
            .where(or_(Device.serial_norm.like(like), Company.norm.like(like), Company.id.in_(alias_hit)))
            .limit(200)
        ).unique().all()
    # 제조번호가 정확히 같은 것 → 제조번호가 이걸로 시작하는 것 → 나머지(업체 · 별칭 일치), 그 안에서는 업체 · 제조번호 순
    rank = lambda d: (d.serial_norm != qn, not d.serial_norm.startswith(qn), d.company.name, d.serial)  # noqa: E731
    return [DeviceRow(id=d.id, company=d.company.name, model=d.model, serial=d.serial, last_receipt_no=d.last_receipt_no)
            for d in sorted(rows, key=rank)[:LIMIT]]
