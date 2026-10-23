"""Pi 내부 API (127.0.0.1:8000/api). 외부 계약이 아니다 — 02 §6 참고용.

    uvicorn app.main:app --host 127.0.0.1 --port 8000

frontend를 빌드해 두면(frontend/dist) 같은 주소에서 화면도 준다. Pi는 어떤 네트워크에도 붙지 않으므로
127.0.0.1에만 연다.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="ktl-flow-pi", docs_url="/api/docs", redoc_url=None, openapi_url="/api/openapi.json")
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
