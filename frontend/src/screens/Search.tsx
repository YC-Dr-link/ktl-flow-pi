import { useEffect, useRef, useState } from "react";
import { api, ApiError, DeviceRow } from "../api";
import { Brand } from "../brand/Logo";
import { Highlight, IconMeter, IconNotFound, IconSearch, initial, StatusChip } from "../ui";

const MIN = 2;          // 2글자부터 (03 시나리오 A-1)
const DEBOUNCE = 150;   // 칠 때마다 요청하지 않게 잠깐 기다렸다가

/** PI-01 기기 검색: 입력할 때마다 목록이 좁혀진다. 줄을 누르면 PI-02. */
export default function Search({ onPick, onRegister }: { onPick: (d: DeviceRow) => void; onRegister: () => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<DeviceRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const term = q.trim();
  const short = term.length < MIN;

  useEffect(() => {
    if (short) {
      setRows(null);
      setErr(null);
      setBusy(false);
      return;
    }
    const ctl = new AbortController();
    setBusy(true);   // 기다리는 동안에도 '찾는 중'으로 보이게 (예전엔 '한 글자 더'가 잠깐 떴다)
    const t = setTimeout(() => {
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
  }, [term, short]);

  const none = !busy && rows !== null && rows.length === 0;
  return (
    <div className="screen">
      <header className="bar">
        <Brand title="유속계 접수" />
        <div className="bar-right">
          <StatusChip />
          <button className="btn ghost sm" disabled title="관리 메뉴는 PI-06(#6)에서">관리</button>
        </div>
      </header>

      <div className="search">
        <div className="field">
          <IconSearch />
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="업체명 · 제조번호 · 별칭"
            aria-label="기기 검색"
            inputMode="search"
          />
        </div>
        {q && <button className="btn" onClick={() => { setQ(""); input.current?.focus(); }} aria-label="지우기">지우기</button>}
      </div>

      <div className="results card" aria-live="polite">
        {busy && <div className="busy" aria-hidden />}
        {err && (
          <div className="empty bad"><IconNotFound /><p>{err}</p></div>
        )}
        {!err && short && (
          <div className="empty">
            <IconMeter />
            <p>{term.length ? "한 글자 더 입력하세요" : "업체명이나 제조번호를 입력하세요"}</p>
            <span className="sub">2글자부터 바로 찾아요 · 작년에 온 기기는 정보가 자동으로 채워집니다</span>
          </div>
        )}
        {!err && !short && busy && rows === null &&
          [0, 1, 2, 3].map((i) => <div key={i} className="skel"><i /><i /><i /><i /></div>)}
        {!err && none && (
          <div className="empty">
            <IconNotFound />
            <p>‘{term}’ 기기를 찾지 못했어요</p>
            <span className="sub">처음 오는 기기라면 아래 [새 기기 등록]을 눌러 주세요</span>
          </div>
        )}
        {!err && !short && rows?.map((d, i) => (
          <button key={d.id} className="row" style={{ ["--i" as string]: i }} onClick={() => onPick(d)}>
            <span className="row-ico" aria-hidden>{initial(d.company)}</span>
            <span className="row-company"><Highlight text={d.company} q={term} /></span>
            <span className="row-model">{d.model}</span>
            <span className="row-serial"><Highlight text={d.serial} q={term} /></span>
            <span className="row-go" aria-hidden>›</span>
          </button>
        ))}
      </div>

      <footer className="foot">
        <button className={`btn${none ? " primary" : ""}`} onClick={onRegister}>+ 새 기기 등록</button>
        {rows && rows.length > 0 && (
          <span className="count"><b>{rows.length}</b>대 찾음{rows.length >= 30 ? " · 더 좁혀 주세요" : ""}</span>
        )}
      </footer>
    </div>
  );
}
