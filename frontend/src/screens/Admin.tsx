import { useEffect, useState } from "react";
import { api, Stats } from "../api";
import { Brand } from "../brand/Logo";
import { IconList, IconPlus, StatusChip } from "../ui";

/**
 * 관리 메뉴 (PI-06 입구). 기기 등록 · 기기 목록/수정.
 * TODO(확인 필요): 03 시나리오 A-6 "관리 메뉴는 시험자 PIN 확인 후 열림" — 시험자 · PIN 관리 방식이 정해지면 여기 앞에 PIN 화면
 */
export default function Admin({ onBack, onRegister, onList }: {
  onBack: () => void; onRegister: () => void; onList: () => void;
}) {
  const [st, setSt] = useState<Stats | null>(null);
  useEffect(() => {
    api<Stats>("/stats").then(setSt).catch(() => setSt(null));
  }, []);

  const tiles = [
    { ico: <IconPlus />, title: "기기 등록", sub: "처음 오는 기기를 등록해요", on: onRegister, main: true },
    { ico: <IconList />, title: "기기 목록 · 수정", sub: "업체명 · 번호가 바뀌면 고쳐요", on: onList },
  ];
  const nums: [string, number | undefined, string][] = [
    ["등록 기기", st?.devices, "대"], ["업체", st?.companies, "곳"], ["형식승인", st?.approvals, "건"], ["오늘 접수", st?.receipts_today, "건"],
  ];

  return (
    <div className="screen">
      <header className="bar">
        <Brand title="관리" sub="KTL 정도검사 자동화 · 관리 메뉴" />
        <div className="bar-right">
          <StatusChip />
          <button className="btn ghost sm" onClick={onBack}>‹ 접수 화면</button>
        </div>
      </header>

      <div className="stats">
        {nums.map(([k, v, unit], i) => (
          <div key={k} className="stat card" style={{ ["--i" as string]: i }}>
            <span className="stat-k">{k}</span>
            <span className="stat-v">{v ?? "–"}<small>{unit}</small></span>
          </div>
        ))}
      </div>

      <div className="tiles">
        {tiles.map((t, i) => (
          <button key={t.title} className={`tile card${t.main ? " main" : ""}`} style={{ ["--i" as string]: i }} onClick={t.on}>
            <span className="tile-ico">{t.ico}</span>
            <span className="tile-title">{t.title}</span>
            <span className="tile-sub">{t.sub}</span>
            <span className="tile-go" aria-hidden>›</span>
          </button>
        ))}
      </div>

      <footer className="foot admin-foot">
        <span>Pi는 네트워크에 연결하지 않아요 · 데이터는 이 기기 안에만 저장됩니다</span>
      </footer>
    </div>
  );
}
