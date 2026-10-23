import { useEffect, useState } from "react";
import type { ReceiptOut } from "../api";

const IDLE_S = 60;   // 60초 동안 아무것도 안 하면 처음으로 (03 시나리오 A-5)

/** PI-05 QR 표시: 가운데 큰 QR + 접수번호 · 제조번호. 실험 PC 스캐너로 찍는다. */
export default function Qr({ r, onHome }: { r: ReceiptOut; onHome: () => void }) {
  const [left, setLeft] = useState(IDLE_S);

  useEffect(() => {
    const reset = () => setLeft(IDLE_S);
    const t = setInterval(() => setLeft((x) => x - 1), 1000);
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearInterval(t);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, []);
  useEffect(() => {
    if (left <= 0) onHome();
  }, [left, onHome]);

  return (
    <div className="screen pi05">
      {/* SVG는 이 Pi의 백엔드가 만든 것 (외부 내용 아님) */}
      <div className="qr" dangerouslySetInnerHTML={{ __html: r.qr_svg }} aria-label="접수 QR" />
      <div className="qr-side">
        <div>
          <div className="qr-k">접수번호</div>
          <div className="qr-v">{r.receipt_no}</div>
          <div className="qr-k">제조번호</div>
          <div className="qr-v">{r.serial}</div>
        </div>
        <p className="hint left">실험 PC 스캐너로 QR을 찍어 주세요</p>
        <div>
          <button className="btn primary home" onClick={onHome}>처음으로</button>
          <div className="idle">{left}초 뒤 자동으로 처음 화면</div>
        </div>
      </div>
    </div>
  );
}
