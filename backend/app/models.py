"""기기 DB (REQ-A1-01 · 02 · 04). 스키마를 바꾸면 migrations/versions에 새 마이그레이션을 추가한다.

업체 ─< 별칭
업체 ─< 기기 >─ 형식승인
기기 ─< 피토관
기기 ─< 접수 기록 (이번 접수번호 · QR)
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


class Base(DeclarativeBase):
    pass


class Company(Base):
    __tablename__ = "companies"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    norm: Mapped[str] = mapped_column(String(200), index=True)   # 검색용 (text.normalize)
    created_at: Mapped[str] = mapped_column(String(40), default=now)
    aliases: Mapped[list[CompanyAlias]] = relationship(back_populates="company", cascade="all, delete-orphan")
    devices: Mapped[list[Device]] = relationship(back_populates="company")


class CompanyAlias(Base):
    """㈜/(주)/영문/약칭 같은 다른 이름 (PI-06에서 추가)."""
    __tablename__ = "company_aliases"
    __table_args__ = (UniqueConstraint("company_id", "norm"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"))
    alias: Mapped[str] = mapped_column(String(200))
    norm: Mapped[str] = mapped_column(String(200), index=True)
    company: Mapped[Company] = relationship(back_populates="aliases")


class Approval(Base):
    """형식승인 기준정보 (PI-04, S). 측정범위 · 차압계 · S/W 버전 · 유효기간."""
    __tablename__ = "approvals"
    approval_no: Mapped[str] = mapped_column(String(60), primary_key=True)
    model: Mapped[str | None] = mapped_column(String(100))
    range_min: Mapped[float | None] = mapped_column(Float)   # m/s
    range_max: Mapped[float | None] = mapped_column(Float)   # m/s
    # TODO(확인 필요): 차압계 범위 · S/W 버전 · 유효기간의 실제 표기 형식 — 연구원님 답을 받으면 칸을 맞춘다
    diff_pressure: Mapped[str | None] = mapped_column(String(100))
    sw_version: Mapped[str | None] = mapped_column(String(60))
    valid_until: Mapped[str | None] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(Text)


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (UniqueConstraint("company_id", "serial_norm"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    model: Mapped[str] = mapped_column(String(100))
    serial: Mapped[str] = mapped_column(String(100))                 # 제조번호 (공백 가능 — 원본 그대로)
    serial_norm: Mapped[str] = mapped_column(String(100), index=True)
    approval_no: Mapped[str | None] = mapped_column(ForeignKey("approvals.approval_no"))
    max_range: Mapped[float] = mapped_column(Float)                  # 최대 측정범위 m/s — QR rg
    last_receipt_no: Mapped[str | None] = mapped_column(String(20))  # 작년 접수번호
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40), default=now)
    updated_at: Mapped[str] = mapped_column(String(40), default=now, onupdate=now)
    company: Mapped[Company] = relationship(back_populates="devices")
    approval: Mapped[Approval | None] = relationship()
    pitots: Mapped[list[PitotTube]] = relationship(back_populates="device", cascade="all, delete-orphan")
    receipts: Mapped[list[Receipt]] = relationship(back_populates="device")


class PitotTube(Base):
    """기기에 딸린 피토관. TODO(확인 필요): 피토관에 따로 관리할 값(계수 · 교정일 등)이 있는지 — 지금은 제조번호 · 메모만."""
    __tablename__ = "pitot_tubes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    serial: Mapped[str | None] = mapped_column(String(100))
    note: Mapped[str | None] = mapped_column(Text)
    device: Mapped[Device] = relationship(back_populates="pitots")


class Receipt(Base):
    """이번 접수 — 접수번호와 만든 QR 문자열을 남긴다 (PI-02 → PI-05)."""
    __tablename__ = "receipts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"))
    receipt_no: Mapped[str] = mapped_column(String(20), index=True)
    qr_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40), default=now)
    device: Mapped[Device] = relationship(back_populates="receipts")
