import { useCallback, useState } from "react";
import type { ReceiptOut } from "./api";
import Admin from "./screens/Admin";
import Device from "./screens/Device";
import Qr from "./screens/Qr";
import Register from "./screens/Register";
import Search from "./screens/Search";
import { Backdrop } from "./ui";

export type Screen =
  | { name: "search" }
  | { name: "device"; id: number; digits?: string }
  | { name: "qr"; receipt: ReceiptOut }
  | { name: "admin" }
  | { name: "devices" }
  | { name: "register"; editId?: number; back: Screen };

/**
 * 화면 흐름 (03 시나리오 A)
 *   PI-01 검색 → PI-02 기기 정보 + 접수번호 → PI-05 QR → 처음으로
 *                 └ [정보 수정] PI-06 → PI-02
 *   [관리] → 관리 메뉴 → PI-06 기기 등록 · 기기 목록 · 수정
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "search" });
  const [n, setN] = useState(0);   // 화면이 바뀔 때마다 들어오는 애니메이션을 다시 돌리려고
  const go = useCallback((s: Screen) => {
    setScreen(s);
    setN((x) => x + 1);
  }, []);
  const home = useCallback(() => go({ name: "search" }), [go]);
  const toQr = (receipt: ReceiptOut) => go({ name: "qr", receipt });

  let body;
  switch (screen.name) {
    case "search":
      body = <Search onPick={(d) => go({ name: "device", id: d.id })} onRegister={() => go({ name: "register", back: screen })}
        onAdmin={() => go({ name: "admin" })} />;
      break;
    case "device":
      body = (
        <Device id={screen.id} initialDigits={screen.digits} onBack={home} onDone={toQr}
          onEdit={(digits) => go({ name: "register", editId: screen.id, back: { name: "device", id: screen.id, digits } })} />
      );
      break;
    case "qr":
      body = <Qr r={screen.receipt} onHome={home} />;
      break;
    case "admin":
      body = <Admin onBack={home} onRegister={() => go({ name: "register", back: screen })} onList={() => go({ name: "devices" })} />;
      break;
    case "devices":
      body = <Search manage onPick={(d) => go({ name: "register", editId: d.id, back: screen })}
        onRegister={() => go({ name: "register", back: screen })} onAdmin={() => go({ name: "admin" })} />;
      break;
    case "register": {
      const back = screen.back;
      body = <Register editId={screen.editId} onCancel={() => go(back)}
        onSaved={(id) => go({ name: "device", id, digits: back.name === "device" ? back.digits : undefined })} />;
      break;
    }
  }

  return (
    <div className="stage">
      <Backdrop />
      <div key={n}>{body}</div>
    </div>
  );
}
