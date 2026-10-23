import { useCallback, useState } from "react";
import type { ReceiptOut } from "./api";
import Device from "./screens/Device";
import Qr from "./screens/Qr";
import Search from "./screens/Search";

type Screen = { name: "search" } | { name: "device"; id: number } | { name: "qr"; receipt: ReceiptOut } | { name: "register" };

/** 화면 흐름: PI-01 검색 → PI-02 기기 정보 + 접수번호 → PI-05 QR → 처음으로 · PI-06 등록(#6) */
export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "search" });
  const home = useCallback(() => setScreen({ name: "search" }), []);

  switch (screen.name) {
    case "search":
      return <Search onPick={(d) => setScreen({ name: "device", id: d.id })} onRegister={() => setScreen({ name: "register" })} />;
    case "device":
      return <Device id={screen.id} onBack={home} onDone={(receipt) => setScreen({ name: "qr", receipt })} />;
    case "qr":
      return <Qr r={screen.receipt} onHome={home} />;
    case "register":
      return (
        <div className="screen">
          <header className="bar"><h1>새 기기 등록</h1></header>
          <div className="results"><p className="hint">기기 등록(PI-06)은 다음 작업에서 연결돼요</p></div>
          <footer className="foot"><button className="btn" onClick={home}>처음으로</button></footer>
        </div>
      );
  }
}
