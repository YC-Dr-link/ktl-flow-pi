import { useEffect, useState } from "react";

/** PI-01 기기 검색 (빈 뼈대). 검색 · 기기 정보 · QR은 뒤 이슈에서 채운다. */
export default function App() {
  const [q, setQ] = useState("");
  const [server, setServer] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => setServer(r.ok ? "ok" : "down"))
      .catch(() => setServer("down"));
  }, []);

  return (
    <div className="screen">
      <header className="bar">
        <h1>유속계 접수</h1>
        <button className="btn ghost" disabled>관리</button>
      </header>

      <div className="search">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="업체명 · 제조번호 · 별칭"
          aria-label="기기 검색"
        />
        <button className="btn primary" disabled={q.trim().length < 2}>검색</button>
      </div>

      <div className="results">
        <p className="hint">{q.trim().length < 2 ? "2글자 이상 입력하면 목록이 나와요" : "검색은 다음 작업에서 연결돼요"}</p>
      </div>

      <footer className="foot">
        <button className="btn">+ 새 기기 등록</button>
        <span className={`status ${server}`}>{server === "ok" ? "서버 연결됨" : server === "down" ? "서버 꺼짐" : "확인 중…"}</span>
      </footer>
    </div>
  );
}
