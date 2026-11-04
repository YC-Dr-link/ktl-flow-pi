import { useCallback, useState } from "react";
import type { ReceiptOut } from "./api";
import { Brand } from "./brand/Logo";
import Device from "./screens/Device";
import Qr from "./screens/Qr";
import Search from "./screens/Search";
import { Backdrop, IconMeter, StatusChip } from "./ui";

type Screen = { name: "search" } | { name: "device"; id: number } | { name: "qr"; receipt: ReceiptOut } | { name: "register" };

/** 화면 흐름: PI-01 검색 → PI-02 기기 정보 + 접수번호 → PI-05 QR → 처음으로 · PI-06 등록(#6) */
export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "search" });
  const [n, setN] = useState(0);   // 화면이 바뀔 때마다 들어오는 애니메이션을 다시 돌리려고
  const go = useCallback((s: Screen) => {
    setScreen(s);
    setN((x) => x + 1);
  }, []);
  const home = useCallback(() => go({ name: "search" }), [go]);

  let body;
  switch (screen.name) {
    case "search":
      body = <Search onPick={(d) => go({ name: "device", id: d.id })} onRegister={() => go({ name: "register" })} />;
      break;
    case "device":
      body = <Device id={screen.id} onBack={home} onDone={(receipt) => go({ name: "qr", receipt })} />;
      break;
    case "qr":
      body = <Qr r={screen.receipt} onHome={home} />;
      break;
    case "register":
      body = (
        <div className="screen">
          <header className="bar">
            <Brand title="새 기기 등록" />
            <StatusChip />
          </header>
          <div className="soon card">
            <IconMeter size={84} />
            <h2>기기 등록 화면을 준비하고 있어요</h2>
            <p>처음 오는 기기는 지금은 관리자에게 등록을 요청해 주세요</p>
          </div>
          <footer className="foot">
            <button className="btn primary" onClick={home}>처음으로</button>
          </footer>
        </div>
      );
  }

  return (
    <div className="stage">
      <Backdrop />
      <div key={n}>{body}</div>
    </div>
  );
}
