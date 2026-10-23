"""기기 정보(PI-02) · 접수 → QR(PI-05). REQ-A1-02 · 03. Pi 안에서만 쓰는 API (02 §6 참고용)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from . import db, qr
from .models import Device, Receipt

router = APIRouter(prefix="/api")
RECEIPT_HINT = "접수번호 형식은 26-000123-01 입니다"


class DeviceDetail(BaseModel):
    id: int
    company: str
    model: str
    serial: str
    approval_no: str | None
    max_range: float
    last_receipt_no: str | None
    pitots: list[str]


def _last_receipt(s, d: Device) -> str | None:
    """작년(직전) 접수번호: Pi에서 접수한 기록이 있으면 가장 최근 것, 없으면 등록할 때 넣은 값."""
    r = s.scalar(select(Receipt.receipt_no).where(Receipt.device_id == d.id).order_by(Receipt.id.desc()).limit(1))
    return r or d.last_receipt_no


@router.get("/devices/{device_id}", response_model=DeviceDetail)
def device_detail(device_id: int) -> DeviceDetail:
    with db.session() as s:
        d = s.scalar(select(Device).options(joinedload(Device.company), joinedload(Device.pitots)).where(Device.id == device_id))
        if not d:
            raise HTTPException(404, "기기를 찾지 못했습니다.")
        return DeviceDetail(id=d.id, company=d.company.name, model=d.model, serial=d.serial, approval_no=d.approval_no,
                            max_range=d.max_range, last_receipt_no=_last_receipt(s, d),
                            pitots=[p.serial for p in d.pitots if p.serial])


class ReceiptIn(BaseModel):
    device_id: int
    receipt_no: str


class ReceiptOut(BaseModel):
    id: int
    receipt_no: str
    serial: str
    qr_text: str
    qr_svg: str


def _number(x: float) -> int | float:
    # 22.0 → 22 : QR의 rg는 테스트 벡터처럼 정수면 정수로 ("rg":22). 소수가 있으면 그대로
    return int(x) if float(x).is_integer() else x


@router.post("/receipts", response_model=ReceiptOut, status_code=201)
def create_receipt(b: ReceiptIn) -> ReceiptOut:
    rn = b.receipt_no.strip()
    if not qr.RECEIPT_RE.match(rn):
        raise HTTPException(400, RECEIPT_HINT)
    with db.session() as s:
        d = s.scalar(select(Device).options(joinedload(Device.company)).where(Device.id == b.device_id))
        if not d:
            raise HTTPException(404, "기기를 찾지 못했습니다.")
        if not d.approval_no:
            raise HTTPException(400, "이 기기에 형식승인번호가 없어서 QR을 만들 수 없습니다. 기기 정보를 먼저 고쳐 주세요.")
        text = qr.qr_text(qr.Receipt(receipt_no=rn, serial=d.serial, approval_no=d.approval_no, model=d.model,
                                     max_range=_number(d.max_range), company=d.company.name))
        r = Receipt(device_id=d.id, receipt_no=rn, qr_text=text)
        s.add(r)
        s.flush()
        return ReceiptOut(id=r.id, receipt_no=rn, serial=d.serial, qr_text=text, qr_svg=qr.qr_svg(text))
