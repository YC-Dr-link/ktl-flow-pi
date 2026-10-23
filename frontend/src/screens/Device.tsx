import { useEffect, useState } from "react";
import { api, ApiError, DeviceDetail, ReceiptOut } from "../api";

/** 숫자만 받아 NN-NNNNNN-NN 모양으로 (`-` 자동) */
export function formatReceipt(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  return [d.slice(0, 2), d.slice(2, 8), d.slice(8, 10)].filter(Boolean).join("-");
}
const DONE = /^\d{2}-\d{6}-\d{2}$/;
const HINT = "접수번호 형식은 26-000123-01 입니다";

/** PI-02 기기 정보 + 이번 접수번호 → [다음] → PI-05 QR (03 시나리오 A-2) */
export default function Device({ id, onBack, onDone }: { id: number; onBack: () => void; onDone: (r: ReceiptOut) => void }) {
  const [d, setD] = useState<DeviceDetail | null>(null);
  const [digits, setDigits] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = formatReceipt(digits);
  const ok = DONE.test(value);

  useEffect(() => {
    api<DeviceDetail>(`/devices/${id}`).then(setD).catch((e: ApiError) => setErr(e.message));
  }, [id]);

  // 실제 키보드 · 바코드 입력도 받는다 (화면 키패드와 같이)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setDigits((x) => (x + e.key).slice(0, 10));
      else if (e.key === "Backspace") setDigits((x) => x.slice(0, -1));
      else if (e.key === "Enter" && ok) next();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  const next = async () => {
    if (!ok || busy) return;
    setBusy(true);
    setErr(null);
    try {
      onDone(await api<ReceiptOut>("/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device_id: id, receipt_no: value }) }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const press = (k: string) => setDigits((x) => (k === "⌫" ? x.slice(0, -1) : k === "C" ? "" : (x + k).slice(0, 10)));

  return (
    <div className="screen">
      <header className="bar">
        <h1>기기 정보</h1>
        <button className="btn ghost" onClick={onBack}>‹ 검색으로</button>
      </header>
      <div className="pi02">
        <div className="left">
          <dl className="info">
            {d ? (
              <>
                <dt>업체</dt><dd className="big">{d.company}</dd>
                <dt>모델</dt><dd>{d.model}</dd>
                <dt>제조번호</dt><dd className="big">{d.serial}</dd>
                <dt>형식승인번호</dt><dd>{d.approval_no ?? <span className="bad">없음</span>}</dd>
                <dt>최대 측정범위</dt><dd>{d.max_range} m/s</dd>
                <dt>작년 접수번호</dt><dd>{d.last_receipt_no ?? "—"}</dd>
              </>
            ) : <dd className="hint">{err ?? "불러오는 중…"}</dd>}
          </dl>
          <button className="btn primary next" disabled={!ok || !d || busy} onClick={next}>{busy ? "만드는 중…" : "다음 ›  QR 만들기"}</button>
        </div>
        <div className="entry">
          <label className="entry-label">이번 접수번호</label>
          <div className={`receipt${value ? "" : " empty"}`}>{value || "26-000123-01"}</div>
          <div className="entry-msg">{value && !ok ? <span className="bad">{HINT}</span> : err && d ? <span className="bad">{err}</span> : " "}</div>
          <div className="keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((k) => (
              <button key={k} className="btn key" onClick={() => press(k)} aria-label={k === "⌫" ? "한 글자 지우기" : k === "C" ? "모두 지우기" : k}>{k}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
