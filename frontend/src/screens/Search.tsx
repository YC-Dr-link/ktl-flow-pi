import { useEffect, useRef, useState } from "react";
import { api, ApiError, DeviceRow } from "../api";

const MIN = 2;          // 2글자부터 (03 시나리오 A-1)
const DEBOUNCE = 150;   // 칠 때마다 요청하지 않게 잠깐 기다렸다가

/** PI-01 기기 검색: 입력할 때마다 목록이 좁혀진다. 줄을 누르면 PI-02. */
export default function Search({ onPick, onRegister }: { onPick: (d: DeviceRow) => void; onRegister: () => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<DeviceRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < MIN) {
      setRows(null);
      setErr(null);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setBusy(true);
      api<DeviceRow[]>(`/devices?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => {
          setRows(r);
          setErr(null);
        })
        .catch((e) => !ctl.signal.aborted && setErr(e instanceof ApiError ? e.message : String(e)))
        .finally(() => !ctl.signal.aborted && setBusy(false));
    }, DEBOUNCE);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const none = rows !== null && rows.length === 0;
  return (
    <div className="screen">
      <header className="bar">
        <h1>유속계 접수</h1>
        <button className="btn ghost" disabled title="관리 메뉴는 PI-06(#6)에서">관리</button>
      </header>

      <div className="search">
        <input
          ref={input}
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="업체명 · 제조번호 · 별칭"
          aria-label="기기 검색"
          inputMode="search"
        />
        {q && <button className="btn" onClick={() => { setQ(""); input.current?.focus(); }} aria-label="지우기">지우기</button>}
      </div>

      <div className="results" aria-live="polite">
        {err && <p className="hint bad">{err}</p>}
        {!err && rows === null && <p className="hint">{q.trim().length ? "한 글자 더 입력하세요" : "업체명이나 제조번호를 2글자 이상 입력하세요"}</p>}
        {!err && none && <p className="hint">등록된 기기가 없습니다</p>}
        {!err && rows?.map((d) => (
          <button key={d.id} className="row" onClick={() => onPick(d)}>
            <span className="row-company">{d.company}</span>
            <span className="row-model">{d.model}</span>
            <span className="row-serial">{d.serial}</span>
            <span className="row-go" aria-hidden>›</span>
          </button>
        ))}
        {busy && <div className="busy" aria-hidden />}
      </div>

      <footer className="foot">
        <button className={`btn${none ? " primary" : ""}`} onClick={onRegister}>+ 새 기기 등록</button>
        {rows && rows.length > 0 && <span className="status">{rows.length}대{rows.length >= 30 ? " (더 좁혀 주세요)" : ""}</span>}
      </footer>
    </div>
  );
}
