import { useState } from "react";
import type { DeviceRow } from "./api";
import Search from "./screens/Search";

type Screen = { name: "search" } | { name: "device"; device: DeviceRow } | { name: "register" };

/** 화면 흐름: PI-01 검색 → PI-02 기기 정보(#5) → PI-05 QR(#5) · PI-06 등록(#6) */
export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "search" });

  if (screen.name === "search")
    return <Search onPick={(device) => setScreen({ name: "device", device })} onRegister={() => setScreen({ name: "register" })} />;

  // 아직 만들지 않은 화면 (다음 이슈에서 채움)
  return (
    <div className="screen">
      <header className="bar">
        <h1>{screen.name === "device" ? "기기 정보" : "새 기기 등록"}</h1>
      </header>
      <div className="results">
        {screen.name === "device"
          ? <p className="hint">{screen.device.company} · {screen.device.model} · {screen.device.serial}<br />기기 정보 · 접수번호 입력(PI-02)은 다음 작업에서 연결돼요</p>
          : <p className="hint">기기 등록(PI-06)은 다음 작업에서 연결돼요</p>}
      </div>
      <footer className="foot">
        <button className="btn" onClick={() => setScreen({ name: "search" })}>처음으로</button>
      </footer>
    </div>
  );
}
