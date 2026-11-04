import { useCallback, useState } from "react";
import type { ReceiptOut } from "./api";
import Admin from "./screens/Admin";
import Device from "./screens/Device";
import Docs from "./screens/Docs";
import Qr from "./screens/Qr";
import Register from "./screens/Register";
import Search from "./screens/Search";
import Specs from "./screens/Specs";
import { Backdrop } from "./ui";

export type Screen =
  | { name: "search" }
  | { name: "device"; id: number; digits?: string }
  | { name: "qr"; receipt: ReceiptOut }
  | { name: "admin" }
  | { name: "devices" }
  | { name: "register"; editId?: number; back: Screen }
  | { name: "docs"; id: number; digits: string }
  | { name: "specs"; id?: number; digits?: string; back: Screen };

/**
 * 화면 흐름 (03 시나리오 A)
 *   PI-01 검색 → PI-02 기기 정보 + 접수번호 → PI-05 QR → 처음으로
 *                 └ [서류로 대조] PI-03 → PI-04 기준정보 → PI-05
 *   [관리] → 관리 메뉴 → PI-06 기기 등록 · 기기 목록 · 수정 · PI-04 기준정보
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
          onEdit={(digits) => go({ name: "register", editId: screen.id, back: { name: "device", id: screen.id, digits } })}
          onDocs={(digits) => go({ name: "docs", id: screen.id, digits })}
          onSpecs={(digits) => go({ name: "specs", id: screen.id, digits, back: { name: "device", id: screen.id, digits } })} />
      );
      break;
    case "qr":
      body = <Qr r={screen.receipt} onHome={home} />;
      break;
    case "admin":
      body = <Admin onBack={home} onRegister={() => go({ name: "register", back: screen })} onList={() => go({ name: "devices" })}
        onSpecs={() => go({ name: "specs", back: screen })} />;
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
    case "docs": {
      const { id, digits } = screen;
      body = <Docs id={id} onBack={() => go({ name: "device", id, digits })}
        onNext={() => go({ name: "specs", id, digits, back: { name: "docs", id, digits } })} />;
      break;
    }
    case "specs": {
      const { id, digits, back } = screen;
      body = <Specs id={id} digits={digits} onBack={() => go(back)} onDone={toQr}
        onReceipt={id ? () => go({ name: "device", id, digits }) : undefined} />;
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
