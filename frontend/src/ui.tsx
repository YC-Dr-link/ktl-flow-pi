import { useEffect, useState } from "react";

/** 배경 꾸밈: 점 격자 · 떠다니는 빛 · 아래 눈금자. 화면 뒤에 한 번만 깐다. */
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <div className="grid" />
      <div className="glow g1" />
      <div className="glow g2" />
      <div className="glow g3" />
      <div className="ticks" />
    </div>
  );
}

/** 오른쪽 위 상태: Pi 서버가 살아 있는지 + 시계. 30초마다 확인한다. */
export function StatusChip() {
  const [now, setNow] = useState(() => new Date());
  const [up, setUp] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch("/api/health")
        .then((r) => alive && setUp(r.ok))
        .catch(() => alive && setUp(false));
    check();
    const t = setInterval(check, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return (
    <span className={`chip${up ? "" : " down"}`} title={up ? "Pi 서버 정상" : "Pi 서버 응답 없음"}>
      <span className="dot" />
      {up ? "접수 가능" : "서버 확인"} · <span className="clock">{hh}:{mm}</span>
    </span>
  );
}

export const IconSearch = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

/** 빈 상태 그림: 유속계(피토관) 실루엣 */
export const IconMeter = ({ size = 72 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 72 72" fill="none" aria-hidden>
    <circle cx="36" cy="36" r="34" fill="currentColor" opacity=".08" />
    <path d="M18 44a18 18 0 0 1 36 0" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".35" />
    <path d="M18 44a18 18 0 0 1 24-17" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <path d="M36 44 47 30l-8 16Z" fill="#E8262F" />
    <circle cx="36" cy="44" r="3.5" fill="currentColor" />
    <path d="M24 54h24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".35" />
  </svg>
);

export const IconNotFound = ({ size = 72 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 72 72" fill="none" aria-hidden>
    <circle cx="36" cy="36" r="34" fill="currentColor" opacity=".08" />
    <circle cx="32" cy="32" r="13" stroke="currentColor" strokeWidth="4" />
    <path d="m42 42 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <path d="M27 32h10" stroke="#E8262F" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

export const IconScanner = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 9V6a2 2 0 0 1 2-2h3M21 4h3a2 2 0 0 1 2 2v3M26 21v3a2 2 0 0 1-2 2h-3M9 26H6a2 2 0 0 1-2-2v-3" />
    <path d="M9 15h12" stroke="#E8262F" strokeWidth="2.4" />
  </svg>
);

export function Check() {
  return (
    <svg className="check" viewBox="0 0 22 22" aria-hidden>
      <circle cx="11" cy="11" r="11" />
      <path d="m6.5 11.3 3 3 6-6.3" />
    </svg>
  );
}

/** 회사 이름 첫 글자 (괄호 · (주) 빼고) */
export function initial(company: string): string {
  const s = company.replace(/\(.*?\)|㈜|주식회사/g, "").trim();
  return s.slice(0, 1) || "?";
}

/** 검색어와 겹치는 부분을 형광펜으로 */
export function Highlight({ text, q }: { text: string; q: string }) {
  const term = q.trim();
  if (!term) return <>{text}</>;
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}
