"""기기 등록 · 수정 (PI-06, REQ-A1-04) + 업체 찾기 · 기준정보 · 요약. Pi 안에서만 쓰는 API (02 §6 참고용).

    POST  /api/devices              새 기기 → 바로 검색된다
    PATCH /api/devices/{id}         고친 칸만 보낸다. 사유(reason) 필수 → 수정 이력에 남는다
    GET   /api/devices/{id}/history 등록 · 수정 이력
    GET   /api/companies?q=         업체 고르기 (별칭 포함)
    GET   /api/specs/{approval_no}  형식승인 기준정보 (PI-04)
    GET   /api/stats                관리 메뉴 요약 숫자
"""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from . import db, qr
from .models import Approval, Company, CompanyAlias, Device, DeviceHistory, PitotTube, Receipt
from .receipts import DeviceDetail, detail
from .text import normalize

router = APIRouter(prefix="/api")

MAX_RANGE_LIMIT = 100.0   # m/s. TODO(확인 필요): 풍동 · 유속계 최대 측정범위의 실제 상한
MAX_PITOTS = 5
MAX_ALIASES = 10


class DeviceIn(BaseModel):
    company: str
    aliases: list[str] = []
    model: str
    serial: str
    approval_no: str
    max_range: float
    range_min: float | None = None
    last_receipt_no: str | None = None
    pitots: list[str] = []


class DevicePatch(BaseModel):
    """고친 칸만 보낸다 (안 보낸 칸은 그대로)."""
    reason: str
    company: str | None = None
    aliases: list[str] | None = None
    model: str | None = None
    serial: str | None = None
    approval_no: str | None = None
    max_range: float | None = None
    range_min: float | None = None
    last_receipt_no: str | None = None
    pitots: list[str] | None = None


def bad(msg: str, code: int = 400) -> HTTPException:
    return HTTPException(code, msg)


# ── 칸 검사: 사람이 읽을 한국어 문구로 400 ──
def _text(v: str | None, label: str, limit: int) -> str:
    s = " ".join((v or "").split())
    if not s:
        raise bad(f"{label}을(를) 입력해 주세요.")
    if len(s) > limit:
        raise bad(f"{label}이(가) 너무 깁니다 ({limit}자까지).")
    return s


def _company_name(v: str | None) -> str:
    s = _text(v, "업체명", 100)
    if not normalize(s):
        raise bad("업체명을 알아볼 수 없습니다. (주) · ㈜ 말고 이름을 넣어 주세요.")
    return s


def _serial(v: str | None) -> str:
    s = _text(v, "제조번호", 50)
    if not normalize(s):
        raise bad("제조번호에 글자나 숫자가 하나는 있어야 합니다.")
    return s


def _approval(v: str | None) -> str:
    # TODO(확인 필요): 형식승인번호의 정확한 표기 규칙. 지금은 공백을 빼고 영문을 대문자로만 맞춘다
    s = "".join(_text(v, "형식승인번호", 60).split()).upper()
    return s


def _max_range(v: float | None) -> float:
    if v is None or not (0 < v <= MAX_RANGE_LIMIT):
        raise bad(f"최대 측정범위는 0보다 크고 {MAX_RANGE_LIMIT:g} m/s 이하로 넣어 주세요.")
    return float(v)


def _range_min(v: float | None, max_range: float) -> float | None:
    if v is None:
        return None
    if not (0 <= v < max_range):
        raise bad("최소 측정범위는 0 이상, 최대 측정범위보다 작아야 합니다.")
    return float(v)


def _receipt_no(v: str | None) -> str | None:
    s = (v or "").strip()
    if not s:
        return None
    if not qr.RECEIPT_RE.match(s):
        raise bad("작년 접수번호 형식은 25-000123-01 입니다.")
    return s


def _unique(items: list[str] | None, label: str, limit: int, key=lambda x: x) -> list[str]:
    out, seen = [], set()
    for raw in items or []:
        s = " ".join(raw.split())
        if not s:
            continue
        if len(s) > 100:
            raise bad(f"{label}이(가) 너무 깁니다 (100자까지).")
        k = key(s)
        if k and k not in seen:
            seen.add(k)
            out.append(s)
    if len(out) > limit:
        raise bad(f"{label}은(는) {limit}개까지 넣을 수 있습니다.")
    return out


def _aliases(items: list[str] | None) -> list[str]:
    return _unique(items, "업체 별칭", MAX_ALIASES, normalize)


def _pitots(items: list[str] | None) -> list[str]:
    return _unique(items, "피토관 제조번호", MAX_PITOTS, normalize)


# ── DB 도우미 ──
def _find_company(s: Session, norm: str) -> Company | None:
    c = s.scalar(select(Company).where(Company.norm == norm))
    if c:
        return c
    cid = s.scalar(select(CompanyAlias.company_id).where(CompanyAlias.norm == norm).limit(1))
    return s.get(Company, cid) if cid else None


def _set_aliases(s: Session, c: Company, aliases: list[str]) -> None:
    want = {normalize(a): a for a in aliases if normalize(a) and normalize(a) != c.norm}
    for a in list(c.aliases):
        if a.norm not in want:
            c.aliases.remove(a)
    have = {a.norm for a in c.aliases}
    for norm, a in want.items():
        if norm not in have:
            c.aliases.append(CompanyAlias(alias=a, norm=norm))
    s.flush()


def _add_alias(c: Company, alias: str) -> None:
    norm = normalize(alias)
    if norm and norm != c.norm and all(a.norm != norm for a in c.aliases):
        c.aliases.append(CompanyAlias(alias=alias, norm=norm))


def _ensure_approval(s: Session, no: str, model: str, max_range: float, range_min: float | None) -> Approval:
    ap = s.get(Approval, no)
    if not ap:
        ap = Approval(approval_no=no, model=model, range_max=max_range, range_min=range_min)
        s.add(ap)
        s.flush()
    elif ap.range_min is None and range_min is not None:
        ap.range_min = range_min
    return ap


def _check_serial_free(s: Session, company_id: int, serial: str, skip_id: int | None = None) -> None:
    other = s.scalar(select(Device).where(Device.company_id == company_id, Device.serial_norm == normalize(serial)))
    if other and other.id != skip_id:
        raise bad(f"이 업체에 제조번호 {other.serial} 기기가 이미 등록되어 있습니다.", 409)


def _snapshot(d: Device) -> dict:
    return {
        "company": d.company.name,
        "aliases": sorted(a.alias for a in d.company.aliases),
        "model": d.model,
        "serial": d.serial,
        "approval_no": d.approval_no,
        "max_range": d.max_range,
        "range_min": d.approval.range_min if d.approval else None,
        "last_receipt_no": d.last_receipt_no,
        "pitots": [p.serial for p in d.pitots if p.serial],
    }


def _load(s: Session, device_id: int) -> Device:
    d = s.scalar(select(Device).options(joinedload(Device.company).joinedload(Company.aliases), joinedload(Device.pitots),
                                        joinedload(Device.approval)).where(Device.id == device_id))
    if not d:
        raise bad("기기를 찾지 못했습니다.", 404)
    return d


@router.post("/devices", response_model=DeviceDetail, status_code=201)
def create_device(b: DeviceIn) -> DeviceDetail:
    name = _company_name(b.company)
    model = _text(b.model, "모델", 50)
    serial = _serial(b.serial)
    approval_no = _approval(b.approval_no)
    max_range = _max_range(b.max_range)
    range_min = _range_min(b.range_min, max_range)
    last = _receipt_no(b.last_receipt_no)
    aliases, pitots = _aliases(b.aliases), _pitots(b.pitots)
    with db.session() as s:
        c = _find_company(s, normalize(name))
        if not c:
            c = Company(name=name, norm=normalize(name))
            s.add(c)
            s.flush()
        else:
            _check_serial_free(s, c.id, serial)
        for a in aliases:
            _add_alias(c, a)
        _ensure_approval(s, approval_no, model, max_range, range_min)
        d = Device(company=c, model=model, serial=serial, serial_norm=normalize(serial), approval_no=approval_no,
                   max_range=max_range, last_receipt_no=last, pitots=[PitotTube(serial=p) for p in pitots])
        s.add(d)
        s.flush()
        d = _load(s, d.id)
        snap = _snapshot(d)
        s.add(DeviceHistory(device_id=d.id, action="create", changes=json.dumps({k: [None, v] for k, v in snap.items()}, ensure_ascii=False)))
        return detail(s, d)


@router.patch("/devices/{device_id}", response_model=DeviceDetail)
def update_device(device_id: int, b: DevicePatch) -> DeviceDetail:
    reason = _text(b.reason, "수정 사유", 200)
    f = b.model_dump(exclude_unset=True)
    with db.session() as s:
        d = _load(s, device_id)
        before = _snapshot(d)

        renamed_from = None
        if "company" in f:
            name = _company_name(b.company)
            cur = d.company
            target = _find_company(s, normalize(name))
            if target and target.id != cur.id:
                _check_serial_free(s, target.id, b.serial if b.serial else d.serial, d.id)
                d.company = target                       # 다른 (이미 있는) 업체로 옮김
            elif name != cur.name and (not target or target.norm == normalize(name)):
                # (같은 업체의 별칭을 쓴 경우는 이름을 바꾸지 않는다)
                # 업체 이름이 바뀜: 이 업체의 기기가 모두 따라가고, 예전 이름은 별칭으로 남겨 계속 찾히게
                renamed_from = cur.name
                cur.name, cur.norm = name, normalize(name)
                for a in list(cur.aliases):
                    if a.norm == cur.norm:
                        cur.aliases.remove(a)
                s.flush()
        if "aliases" in f:
            _set_aliases(s, d.company, _aliases(b.aliases))
        if renamed_from:
            _add_alias(d.company, renamed_from)
        if "model" in f:
            d.model = _text(b.model, "모델", 50)
        if "serial" in f:
            serial = _serial(b.serial)
            _check_serial_free(s, d.company.id, serial, d.id)
            d.serial, d.serial_norm = serial, normalize(serial)
        if "max_range" in f:
            d.max_range = _max_range(b.max_range)
        if "approval_no" in f:
            d.approval_no = _approval(b.approval_no)
            d.approval = _ensure_approval(s, d.approval_no, d.model, d.max_range, None)
        if "range_min" in f:
            rm = _range_min(b.range_min, d.max_range)
            if d.approval is None:
                raise bad("형식승인번호가 없어서 최소 측정범위를 넣을 수 없습니다.")
            d.approval.range_min = rm                   # 형식승인 기준값 — 같은 형식승인 기기에 함께 적용
        if "last_receipt_no" in f:
            d.last_receipt_no = _receipt_no(b.last_receipt_no)
        if "pitots" in f:
            want = _pitots(b.pitots)
            keep = {normalize(p) for p in want}
            for p in list(d.pitots):
                if normalize(p.serial) not in keep:
                    d.pitots.remove(p)
            have = {normalize(p.serial) for p in d.pitots}
            for p in want:
                if normalize(p) not in have:
                    d.pitots.append(PitotTube(serial=p))
        s.flush()
        s.expire_all()
        d = _load(s, device_id)
        after = _snapshot(d)
        changes = {k: [before[k], after[k]] for k in after if before[k] != after[k]}
        if changes:
            s.add(DeviceHistory(device_id=d.id, action="update", changes=json.dumps(changes, ensure_ascii=False), reason=reason))
        return detail(s, d)


class HistoryRow(BaseModel):
    id: int
    action: str
    changes: dict
    reason: str | None
    created_at: str


@router.get("/devices/{device_id}/history", response_model=list[HistoryRow])
def device_history(device_id: int) -> list[HistoryRow]:
    with db.session() as s:
        if not s.get(Device, device_id):
            raise bad("기기를 찾지 못했습니다.", 404)
        rows = s.scalars(select(DeviceHistory).where(DeviceHistory.device_id == device_id).order_by(DeviceHistory.id.desc())).all()
        return [HistoryRow(id=h.id, action=h.action, changes=json.loads(h.changes), reason=h.reason, created_at=h.created_at) for h in rows]


class CompanyRow(BaseModel):
    id: int
    name: str
    aliases: list[str]
    devices: int


@router.get("/companies", response_model=list[CompanyRow])
def companies(q: str = "") -> list[CompanyRow]:
    """업체 고르기: 이름 · 별칭 일부로 찾는다. q가 비면 전부(가나다순)."""
    qn = normalize(q)
    with db.session() as s:
        stmt = select(Company).options(joinedload(Company.aliases))
        if qn:
            like = f"%{qn}%"
            stmt = stmt.where(or_(Company.norm.like(like), Company.id.in_(select(CompanyAlias.company_id).where(CompanyAlias.norm.like(like)))))
        cs = s.scalars(stmt).unique().all()
        counts = dict(s.execute(select(Device.company_id, func.count()).group_by(Device.company_id)).all())
        rank = lambda c: (not c.norm.startswith(qn), c.name)  # noqa: E731
        return [CompanyRow(id=c.id, name=c.name, aliases=[a.alias for a in c.aliases], devices=counts.get(c.id, 0))
                for c in sorted(cs, key=rank)[:20]]


class SpecOut(BaseModel):
    approval_no: str
    model: str | None
    range_min: float | None
    range_max: float | None
    diff_pressure: str | None
    sw_version: str | None
    valid_until: str | None
    devices: int


@router.get("/specs/{approval_no}", response_model=SpecOut)
def spec(approval_no: str) -> SpecOut:
    """형식승인 기준정보 (PI-04). 차압계 · S/W · 유효기간은 아직 비어 있을 수 있다 (models.Approval TODO 참고)."""
    with db.session() as s:
        ap = s.get(Approval, approval_no)
        if not ap:
            raise bad("형식승인 기준정보가 없습니다.", 404)
        n = s.scalar(select(func.count()).select_from(Device).where(Device.approval_no == ap.approval_no)) or 0
        return SpecOut(approval_no=ap.approval_no, model=ap.model, range_min=ap.range_min, range_max=ap.range_max,
                       diff_pressure=ap.diff_pressure, sw_version=ap.sw_version, valid_until=ap.valid_until, devices=n)


class Stats(BaseModel):
    devices: int
    companies: int
    approvals: int
    receipts_today: int


@router.get("/stats", response_model=Stats)
def stats() -> Stats:
    today = datetime.now().astimezone().date().isoformat()
    with db.session() as s:
        count = lambda m: s.scalar(select(func.count()).select_from(m)) or 0  # noqa: E731
        rt = s.scalar(select(func.count()).select_from(Receipt).where(Receipt.created_at.like(f"{today}%"))) or 0
        return Stats(devices=count(Device), companies=count(Company), approvals=count(Approval), receipts_today=rt)
