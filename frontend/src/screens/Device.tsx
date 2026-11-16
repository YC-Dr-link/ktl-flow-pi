import { useEffect, useState } from "react";
import { api, ApiError, createReceipt, DeviceDetail, ReceiptOut } from "../api";
import { Brand } from "../brand/Logo";
import { IconEdit, initial } from "../ui";

/** 숫자만 받아 NN-NNNNNN-NN 모양으로 (`-` 자동) */
export function formatReceipt(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  return [d.slice(0, 2), d.slice(2, 8), d.slice(8, 10)].filter(Boolean).join("-");
}
const DONE = /^\d{2}-\d{6}-\d{2}$/;
const HINT = "접수번호 형식은 26-000123-01 입니다";
const MASK = "00-000000-00";

/** 입력한 자리는 하나씩 튀어나오고, 남은 자리는 옅은 0으로 보인다 */
function ReceiptView({ digits }: { digits: string }) {
  const out = [];
  let k = 0;
  for (let i = 0; i < MASK.length; i++) {
    if (MASK[i] === "-") {
      out.push(<span key={i} className={k < digits.length ? "sep" : "ph"}>-</span>);
      continue;
    }
    if (k === digits.length) out.push(<span key="caret" className="caret" />);
    out.push(k < digits.length ? <span key={i} className="d">{digits[k]}</span> : <span key={i} className="ph">0</span>);
    k++;
  }
  return <>{out}</>;
}

/** 기기 피토관 줄: 제조번호 목록 */
function Pitots({ list }: { list: string[] }) {
  if (!list.length) return <>—</>;
  return <span className="pitots"><span className="pitot-list">{list.join(" · ")}</span></span>;
}

/** PI-02 기기 정보 + 이번 접수번호 → [다음] → PI-05 QR (03 시나리오 A-2) */
export default function Device({ id, initialDigits = "", onBack, onDone, onEdit }: {
  id: number; initialDigits?: string; onBack: () => void; onDone: (r: ReceiptOut) => void;
  onEdit: (digits: string) => void;
}) {
  const [d, setD] = useState<DeviceDetail | null>(null);
  const [digits, setDigits] = useState(initialDigits);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const value = formatReceipt(digits);
  const ok = DONE.test(value);

  useEffect(() => {
    api<DeviceDetail>(`/devices/${id}`).then(setD).catch((e: ApiError) => setErr(e.message));
  }, [id]);

  const next = async () => {
    if (busy) return;
    if (!ok) {
      setShake((x) => x + 1);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      onDone(await createReceipt(id, value));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
      setShake((x) => x + 1);
    } finally {
      setBusy(false);
    }
  };

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

  // 접수 실패 문구는 번호를 다시 고치기 시작하면 지운다
  useEffect(() => {
    if (d) setErr(null);
  }, [digits]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (k: string) => setDigits((x) => (k === "⌫" ? x.slice(0, -1) : k === "C" ? "" : (x + k).slice(0, 10)));
  const state = !digits ? " blank" : ok ? " done" : "";

  return (
    <div className="screen">
      <header className="bar">
        <Brand title="기기 정보 확인" />
        <div className="bar-right">
          <button className="btn ghost sm" onClick={() => onEdit(digits)} disabled={!d}><IconEdit />정보 수정</button>
          <button className="btn ghost sm" onClick={onBack}>‹ 검색으로</button>
        </div>
      </header>
      <div className="pi02">
        <div className="left">
          <div className="devcard card">
            {d ? (
              <>
                <div className="devhead">
                  <span className="avatar" aria-hidden>{initial(d.company)}</span>
                  <div>
                    <div className="company">{d.company}</div>
                    <div className="model">모델 {d.model}</div>
                  </div>
                </div>
                <dl className="info">
                  <dt>제조번호</dt><dd className="big" style={{ ["--i" as string]: 0 }}>{d.serial}</dd>
                  <dt>형식승인번호</dt><dd style={{ ["--i" as string]: 1 }}>{d.approval_no ?? <span className="tag">없음 · 확인 필요</span>}</dd>
                  <dt>최대 측정범위</dt><dd style={{ ["--i" as string]: 2 }}>{d.max_range} m/s</dd>
                  <dt>작년 접수번호</dt><dd style={{ ["--i" as string]: 3 }}>{d.last_receipt_no ?? "—"}</dd>
                  <dt>피토관</dt><dd style={{ ["--i" as string]: 4 }}><Pitots list={d.pitots} /></dd>
                </dl>
              </>
            ) : err ? (
              <div className="loading"><p className="bad">{err}</p></div>
            ) : (
              <div className="loading"><i style={{ width: "60%", height: 28 }} /><i /><i style={{ width: "80%" }} /><i style={{ width: "70%" }} /></div>
            )}
          </div>
          <div className="actions">
            <button className="btn primary next" disabled={!ok || !d || busy} onClick={next}>{busy ? "QR 만드는 중…" : "다음 ›  QR 만들기"}</button>
          </div>
        </div>
        <div className="entry">
          <label className="entry-label">이번 접수번호</label>
          <div key={shake} className={`receipt${state}${shake ? " err" : ""}`} aria-label={value || "접수번호 입력 전"}>
            <ReceiptView digits={digits} />
          </div>
          <div className="entry-msg">
            {err && d ? <span className="bad">{err}</span>
              : ok ? <span className="ok-msg">✓ 형식이 맞아요. [다음]을 누르세요</span>
              : value && digits.length === 10 ? <span className="bad">{HINT}</span>
              : <span className="hint-sm">숫자 10자리 · ‘-’는 자동으로 들어가요</span>}
          </div>
          <div className="keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((k) => (
              <button key={k} className={`btn key${k === "C" || k === "⌫" ? " fn" : ""}`} onClick={() => press(k)}
                aria-label={k === "⌫" ? "한 글자 지우기" : k === "C" ? "모두 지우기" : k}>{k}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
