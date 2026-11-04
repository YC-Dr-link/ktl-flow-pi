"""Pi 내부 API (127.0.0.1:8000/api). 외부 계약이 아니다 — 02 §6 참고용.

    uvicorn app.main:app --host 127.0.0.1 --port 8000

frontend를 빌드해 두면(frontend/dist) 같은 주소에서 화면도 준다. Pi는 어떤 네트워크에도 붙지 않으므로
127.0.0.1에만 연다.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import db, devices, receipts, registry

app = FastAPI(title="ktl-flow-pi", docs_url="/api/docs", redoc_url=None, openapi_url="/api/openapi.json")
app.include_router(devices.router)
app.include_router(receipts.router)
app.include_router(registry.router)

FIELD_KO = {"company": "업체명", "model": "모델", "serial": "제조번호", "approval_no": "형식승인번호", "max_range": "최대 측정범위",
            "range_min": "최소 측정범위", "last_receipt_no": "작년 접수번호", "pitots": "피토관", "aliases": "업체 별칭",
            "reason": "수정 사유", "device_id": "기기", "receipt_no": "접수번호"}


@app.exception_handler(RequestValidationError)
async def _invalid(_: Request, e: RequestValidationError) -> JSONResponse:
    """형식이 틀린 입력도 화면에 그대로 보여 줄 수 있는 한국어 한 줄로 (03 공통 규칙: 코드값 숨기기)."""
    locs = [str(x) for err in e.errors() for x in err.get("loc", ()) if isinstance(x, str) and x != "body"]
    label = FIELD_KO.get(locs[-1] if locs else "", "입력값")
    return JSONResponse({"detail": f"{label} 형식이 맞지 않습니다."}, status_code=400)


@app.on_event("startup")
def _migrate() -> None:
    db.upgrade()   # DB가 없으면 만들고, 스키마가 바뀌었으면 맞춘다


DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


if (DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/{path:path}", include_in_schema=False)
def spa(path: str):
    """빌드된 화면을 준다. 화면 안의 주소(/register 등)로 바로 들어와도 index.html."""
    if path.startswith("api/"):
        return JSONResponse({"detail": "없는 API입니다."}, status_code=404)
    index = DIST / "index.html"
    f = (DIST / path).resolve()
    if path and f.is_file() and f.is_relative_to(DIST.resolve()):
        return FileResponse(f)
    if not index.exists():
        return JSONResponse({"detail": "화면이 아직 빌드되지 않았습니다 (frontend에서 npm run build)."}, status_code=503)
    return FileResponse(index, headers={"Cache-Control": "no-cache"})
