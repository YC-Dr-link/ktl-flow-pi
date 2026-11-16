import { KeyboardEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { api, ApiError, CompanyRow, DeviceDetail, DeviceForm, send } from "../api";
import { Brand } from "../brand/Logo";
import { Check, IconWarn, initial, norm } from "../ui";
import { formatReceipt } from "./Device";

/**
 * PI-06 기기 등록 · 수정 (REQ-A1-04, 03 시나리오 A-6).
 * 480px 높이에 맞춰 4단계: ① 업체 → ② 기기 → ③ 범위 · 기록 → ④ 확인(수정이면 바뀐 칸 + 사유)
 * 저장하면 완료 애니메이션 뒤 그 기기의 PI-02로 간다 (등록 후 바로 검색됨).
 */

const STEPS = ["업체", "기기", "범위 · 기록", "확인"];
const REASONS = ["업체명 변경", "오타 수정", "기기 정보 정정", "피토관 교체"];
const MAX_RANGE = 100;   // 백엔드 registry.MAX_RANGE_LIMIT와 같게
const RECEIPT = /^\d{2}-\d{6}-\d{2}$/;

type F = { company: string; aliases: string[]; model: string; serial: string; approval_no: string; max_range: string; range_min: string; last: string; pitots: string[] };
type Key = keyof F;
const EMPTY: F = { company: "", aliases: [], model: "", serial: "", approval_no: "", max_range: "", range_min: "", last: "", pitots: [] };

const LABEL: Record<Key, string> = {
  company: "업체명", aliases: "업체 별칭", model: "모델", serial: "제조번호", approval_no: "형식승인번호",
  max_range: "최대 측정범위", range_min: "최소 측정범위", last: "작년 접수번호", pitots: "피토관",
};
const STEP_OF: Record<Key, number> = { company: 0, aliases: 0, model: 1, serial: 1, approval_no: 1, max_range: 2, range_min: 2, last: 2, pitots: 2 };

function fromDetail(d: DeviceDetail): F {
  return {
    company: d.company, aliases: d.aliases, model: d.model, serial: d.serial, approval_no: d.approval_no ?? "",
    max_range: String(d.max_range), range_min: d.range_min == null ? "" : String(d.range_min),
    last: d.last_receipt_no ?? "", pitots: d.pitots,
  };
}

function toPayload(f: F): DeviceForm {
  return {
    company: f.company.trim(), aliases: f.aliases, model: f.model.trim(), serial: f.serial.trim(),
    approval_no: f.approval_no.replace(/\s+/g, "").toUpperCase(), max_range: Number(f.max_range),
    range_min: f.range_min.trim() === "" ? null : Number(f.range_min), last_receipt_no: f.last || null, pitots: f.pitots,
  };
}

/** 단계별 검사 — 서버(app/registry.py)와 같은 규칙. 고칠 칸 → 문구 */
function check(f: F, step: number): Partial<Record<Key, string>> {
  const e: Partial<Record<Key, string>> = {};
  if (step === 0) {
    if (!f.company.trim()) e.company = "업체명을 입력해 주세요";
    else if (!norm(f.company)) e.company = "(주) · ㈜ 말고 이름을 넣어 주세요";
  }
  if (step === 1) {
    if (!f.model.trim()) e.model = "모델을 입력해 주세요";
    if (!norm(f.serial)) e.serial = "제조번호를 입력해 주세요";
    if (!f.approval_no.trim()) e.approval_no = "QR에 들어가는 값이라 꼭 필요해요";
  }
  if (step === 2) {
    const mx = Number(f.max_range);
    if (!f.max_range.trim() || !(mx > 0 && mx <= MAX_RANGE)) e.max_range = `0보다 크고 ${MAX_RANGE} 이하`;
    if (f.range_min.trim() !== "") {
      const mn = Number(f.range_min);
      if (!(mn >= 0) || (mx > 0 && mn >= mx)) e.range_min = "0 이상, 최대보다 작게";
    }
    if (f.last && !RECEIPT.test(f.last)) e.last = "형식은 25-000123-01";
  }
  return e;
}

function Field({ label, need, error, hint, children, wide }: { label: string; need?: boolean; error?: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`fld${error ? " has-err" : ""}${wide ? " wide" : ""}`}>
      <span className="fld-l">{label}{need ? <em>필수</em> : <i>선택</i>}</span>
      {children}
      <span className={error ? "fld-err" : "fld-hint"}>{error ?? hint ?? ""}</span>
    </label>
  );
}

/** 칩으로 쌓는 입력 (업체 별칭 · 피토관). Enter 또는 [추가] */
function ChipField({ items, onChange, placeholder, max, upper }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; max: number; upper?: boolean }) {
  const [t, setT] = useState("");
  const add = () => {
    const v = (upper ? t.toUpperCase() : t).trim();
    if (v && items.length < max && !items.some((x) => norm(x) === norm(v))) onChange([...items, v]);
    setT("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !t && items.length) onChange(items.slice(0, -1));
  };
  return (
    <div className="chipfield">
      {items.map((x, i) => (
        <span key={x} className="tchip" style={{ ["--i" as string]: i }}>
          {x}
          <button type="button" onClick={() => onChange(items.filter((y) => y !== x))} aria-label={`${x} 빼기`}>×</button>
        </span>
      ))}
      {items.length < max && (
        <span className="chip-add">
          <input value={t} onChange={(e) => setT(e.target.value)} onKeyDown={onKey} placeholder={placeholder} />
          <button type="button" className="btn sm" onClick={add} disabled={!t.trim()}>추가</button>
        </span>
      )}
    </div>
  );
}

function show(k: Key, v: F[Key]): string {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (!v) return "—";
  if (k === "approval_no") return v.replace(/\s+/g, "").toUpperCase();
  return k === "max_range" || k === "range_min" ? `${v} m/s` : v;
}

export default function Register({ editId, onCancel, onSaved }: { editId?: number; onCancel: () => void; onSaved: (id: number) => void }) {
  const edit = editId != null;
  const [orig, setOrig] = useState<DeviceDetail | null>(null);
  const [f, setF] = useState<F>(EMPTY);
  const [step, setStep] = useState(0);
  const [errs, setErrs] = useState<Partial<Record<Key, string>>>({});
  const [shake, setShake] = useState(0);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<DeviceDetail | null>(null);
  const [cos, setCos] = useState<CompanyRow[]>([]);

  useEffect(() => {
    if (!edit) return;
    api<DeviceDetail>(`/devices/${editId}`).then((d) => {
      setOrig(d);
      setF(fromDetail(d));
    }).catch((e: ApiError) => setLoadErr(e.message));
  }, [edit, editId]);

  // 업체 고르기: 칠 때마다 기존 업체 · 별칭에서 찾는다
  const cq = f.company.trim();
  useEffect(() => {
    if (step !== 0) return;
    const t = setTimeout(() => api<CompanyRow[]>(`/companies?q=${encodeURIComponent(cq)}`).then(setCos).catch(() => setCos([])), 150);
    return () => clearTimeout(t);
  }, [cq, step]);
  const match = cos.find((c) => norm(c.name) === norm(cq) || c.aliases.some((a) => norm(a) === norm(cq)));
  const sugg = cq && !match ? cos.slice(0, 3) : !cq ? cos.slice(0, 3) : [];

  const set = <K extends Key>(k: K, v: F[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrs((x) => ({ ...x, [k]: undefined }));
    setServerErr(null);
  };
  const pick = (c: CompanyRow) => {
    setF((x) => ({ ...x, company: c.name, aliases: edit ? x.aliases : c.aliases }));
    setErrs((x) => ({ ...x, company: undefined }));
  };

  const base = useMemo(() => (orig ? fromDetail(orig) : null), [orig]);
  const changed = useMemo(() => {
    if (!base) return [] as Key[];
    return (Object.keys(LABEL) as Key[]).filter((k) => {
      const a = base[k], b = f[k];
      if (Array.isArray(a) && Array.isArray(b)) return [...a].sort().join("\u0001") !== [...b].sort().join("\u0001") || (k === "pitots" && a.join() !== b.join());
      if (k === "max_range" || k === "range_min") return (a === "" ? null : Number(a)) !== (b === "" ? null : Number(b));
      return String(a).trim() !== String(b).trim();
    });
  }, [base, f]);

  const go = (to: number) => {
    if (to > step) {
      for (let s = step; s < to; s++) {
        const e = check(f, s);
        if (Object.keys(e).length) {
          setErrs(e);
          setStep(s);
          setShake((x) => x + 1);
          return;
        }
      }
    }
    setErrs({});
    setServerErr(null);
    setStep(to);
  };

  const save = async () => {
    if (saving) return;
    for (let s = 0; s < 3; s++) {
      const e = check(f, s);
      if (Object.keys(e).length) {
        setErrs(e);
        setStep(s);
        setShake((x) => x + 1);
        return;
      }
    }
    setSaving(true);
    setServerErr(null);
    try {
      const p = toPayload(f);
      let d: DeviceDetail;
      if (edit) {
        const patch: Record<string, unknown> = { reason };
        for (const k of changed) {
          const pk = k === "last" ? "last_receipt_no" : k;
          patch[pk] = (p as unknown as Record<string, unknown>)[pk];
        }
        d = await send<DeviceDetail>(`/devices/${editId}`, "PATCH", patch);
      } else {
        d = await send<DeviceDetail>("/devices", "POST", p);
      }
      setDone(d);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      setShake((x) => x + 1);
      // 서버가 짚은 칸이 있는 단계로 되돌려 보여 준다
      const k = (Object.keys(LABEL) as Key[]).find((key) => msg.includes(LABEL[key]));
      if (k) {
        setErrs({ [k]: msg });
        setStep(STEP_OF[k]);
      } else setServerErr(msg);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => onSaved(done.id), 2200);
    return () => clearTimeout(t);
  }, [done, onSaved]);

  const renameNote = edit && orig && norm(f.company) !== norm(orig.company) && !match && orig.company_devices > 1
    ? `이 업체 기기 ${orig.company_devices}대의 업체명이 함께 바뀌고, 예전 이름은 별칭으로 남아요` : null;
  const blocked = edit && (!changed.length || !reason.trim());

  let body: ReactNode;
  if (edit && !orig) {
    body = loadErr ? <div className="notice card"><p className="bad">{loadErr}</p></div> : <div className="loading card"><i /><i style={{ width: "70%" }} /><i style={{ width: "50%" }} /></div>;
  } else if (step === 0) {
    body = (
      <div className="form-grid two">
        <div className="col">
          <Field label="업체명" need error={errs.company} hint={renameNote ?? (match ? undefined : cq ? "새 업체로 등록돼요" : "기존 업체는 아래에서 고르세요")}>
            <div className="inp-wrap">
              <input className="inp" value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="예) 가나다테크(주)" autoFocus={!edit} />
              {match && <span className="inp-badge ok">기존 업체 · {match.devices}대</span>}
            </div>
          </Field>
          <div className="sugg">
            {sugg.map((c, i) => (
              <button key={c.id} type="button" className="sugg-row" style={{ ["--i" as string]: i }} onClick={() => pick(c)}>
                <b>{c.name}</b>
                <span>{c.aliases.slice(0, 2).join(" · ")}</span>
                <small>{c.devices}대</small>
              </button>
            ))}
          </div>
          {match && (
            <div className="co-card">
              <span className="avatar" aria-hidden>{initial(match.name)}</span>
              <div>
                <b>{match.name}</b>
                <span>{edit && orig ? `수정 이력 ${orig.edits}건 · ` : "이 업체에 기기를 추가해요 · "}등록 기기 {match.devices}대</span>
              </div>
            </div>
          )}
        </div>
        <div className="col">
          <Field label="업체 별칭" hint="㈜ · (주) · 영문 · 약칭 — 이 이름으로도 검색돼요">
            <ChipField items={f.aliases} onChange={(v) => set("aliases", v)} placeholder="별칭 입력" max={10} />
          </Field>
        </div>
      </div>
    );
  } else if (step === 1) {
    const qrPreview = `"sn":"${f.serial.trim() || "…"}","ap":"${f.approval_no.replace(/\s+/g, "").toUpperCase() || "…"}","md":"${f.model.trim() || "…"}"`;
    body = (
      <div className="form-grid two">
        <Field label="모델" need error={errs.model}>
          <input className="inp" value={f.model} onChange={(e) => set("model", e.target.value)} placeholder="예) FM-300" autoFocus={!edit} />
        </Field>
        <Field label="제조번호" need error={errs.serial} hint="공백 · 기호도 그대로 적어 주세요">
          <input className="inp" value={f.serial} onChange={(e) => set("serial", e.target.value)} placeholder="예) MB-0001" />
        </Field>
        <Field label="형식승인번호" need error={errs.approval_no}>
          <input className="inp" value={f.approval_no} onChange={(e) => set("approval_no", e.target.value)} placeholder="예) ABCD-2024-5" />
        </Field>
        <div className="qr-peek">
          <span className="qr-peek-k">QR에 들어가는 값</span>
          <code>{qrPreview}</code>
        </div>
      </div>
    );
  } else if (step === 2) {
    body = (
      <div className="form-grid two">
        <Field label="최대 측정범위" need error={errs.max_range} hint="QR rg · 반복성 계산의 분모">
          <div className="inp-wrap"><input className="inp num" inputMode="decimal" value={f.max_range} onChange={(e) => set("max_range", e.target.value.replace(/[^\d.]/g, ""))} placeholder="30" autoFocus={!edit} /><span className="unit">m/s</span></div>
        </Field>
        <Field label="최소 측정범위" error={errs.range_min} hint="형식승인 기준값">
          <div className="inp-wrap"><input className="inp num" inputMode="decimal" value={f.range_min} onChange={(e) => set("range_min", e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.5" /><span className="unit">m/s</span></div>
        </Field>
        <Field label="작년 접수번호" error={errs.last} hint="숫자만 · ‘-’는 자동">
          <input className="inp num" inputMode="numeric" value={f.last} onChange={(e) => set("last", formatReceipt(e.target.value))} placeholder="25-000123-01" />
        </Field>
        <Field label="피토관 제조번호" hint="여러 개면 하나씩 추가 (5개까지)">
          <ChipField items={f.pitots} onChange={(v) => set("pitots", v)} placeholder="예) PT-M0001" max={5} upper />
        </Field>
      </div>
    );
  } else {
    const keys = (Object.keys(LABEL) as Key[]);
    body = (
      <div className="confirm">
        <dl className="sum card">
          {keys.map((k, i) => {
            const ch = edit && changed.includes(k);
            return (
              <div key={k} className={`sum-row${ch ? " ch" : ""}${edit && !ch ? " dim" : ""}`} style={{ ["--i" as string]: i }}>
                <dt>{LABEL[k]}</dt>
                <dd>
                  {ch && base ? <><s>{show(k, base[k])}</s> → </> : null}
                  <b>{show(k, f[k])}</b>
                </dd>
              </div>
            );
          })}
        </dl>
        {edit ? (
          <div className="reason">
            <span className="reason-k">{changed.length ? <>수정 사유 <em>필수</em> · 바뀐 칸 {changed.length}개는 이력에 남아요</> : "바뀐 내용이 없어요"}</span>
            <div className="reason-row">
              {REASONS.map((r) => (
                <button key={r} type="button" className={`rchip${reason === r ? " on" : ""}`} onClick={() => setReason(r)} disabled={!changed.length}>{r}</button>
              ))}
            </div>
          </div>
        ) : (
          <p className="confirm-note"><Check /> 등록하면 바로 검색되고, 이번 접수를 이어서 할 수 있어요</p>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="bar">
        <Brand title={edit ? "기기 정보 수정" : "새 기기 등록"} sub={edit && orig ? `${orig.company} · ${orig.serial}` : "PI-06 · 기기 등록"} />
        <button className="btn ghost sm" onClick={onCancel}>취소</button>
      </header>

      <ol className="stepper" aria-label="단계">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? "on" : i < step ? "past" : ""}>
            <button type="button" onClick={() => go(i)} disabled={edit && !orig}>
              <span className="num">{i < step ? "✓" : i + 1}</span>{s}
            </button>
          </li>
        ))}
      </ol>

      <div key={`${step}-${shake}`} className={`form-body${shake ? " err" : ""}`}>{body}</div>

      <footer className="foot form-foot">
        {step === 0 ? <span /> : <button className="btn" onClick={() => go(step - 1)}>‹ 이전</button>}
        {serverErr && <span className="form-err"><IconWarn /> {serverErr}</span>}
        {step < 3
          ? <button className="btn primary wide" onClick={() => go(step + 1)} disabled={edit && !orig}>다음 ›</button>
          : <button className="btn primary wide" onClick={save} disabled={saving || blocked}>{saving ? "저장하는 중…" : edit ? "저장하기" : "등록하기"}</button>}
      </footer>

      {done && (
        <div className="done-overlay" role="status">
          <div className="done-card card">
            <span className="burst" aria-hidden />
            <svg className="check big" viewBox="0 0 22 22" aria-hidden><circle cx="11" cy="11" r="11" /><path d="m6.5 11.3 3 3 6-6.3" /></svg>
            <h2>{edit ? "수정했어요" : "등록했어요"}</h2>
            <p><b>{done.company}</b> · {done.model} · {done.serial}</p>
            <span className="sub">{edit ? "수정 이력에 남겼어요" : "이제 검색에서 바로 찾을 수 있어요"} · 기기 정보로 이동합니다</span>
            <button className="btn primary" onClick={() => onSaved(done.id)}>바로 접수하기 ›</button>
            <span className="done-bar" aria-hidden />
          </div>
        </div>
      )}
    </div>
  );
}
