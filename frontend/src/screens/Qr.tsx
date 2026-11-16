import { useEffect, useState } from "react";
import type { ReceiptOut } from "../api";
import { Check, IconScanner } from "../ui";

const IDLE_S = 60;   // 60초 동안 아무것도 안 하면 처음으로 (03 시나리오 A-5)
const R = 24;
const C = 2 * Math.PI * R;

/** PI-05 QR 표시: 큰 QR + 접수번호 · 제조번호. 실험 PC 스캐너로 찍는다. */
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
      <div className="qrwrap">
        {/* SVG는 이 Pi의 백엔드가 만든 것 (외부 내용 아님) */}
        <div className="qr" dangerouslySetInnerHTML={{ __html: r.qr_svg }} aria-label="접수 QR" />
        <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
        <span className="scan" aria-hidden />
      </div>
      <div className="qr-side">
        <div>
          <span className="done-badge"><Check /> 접수 QR 완성</span>
          <div className="qr-k">접수번호</div>
          <div className="qr-v">{r.receipt_no}</div>
          <div className="qr-k">제조번호</div>
          <div className="qr-v sm">{r.serial}</div>
        </div>
        <div className="scan-hint"><IconScanner /> 실험 PC 스캐너로 왼쪽 QR을 찍어 주세요</div>
        <div className="home-row">
          <button className="btn primary" onClick={onHome}>처음으로</button>
          <div className="ring" title={`${left}초 뒤 자동으로 처음 화면`}>
            <svg width="56" height="56" viewBox="0 0 56 56">
              <circle className="track" cx="28" cy="28" r={R} />
              <circle className="val" cx="28" cy="28" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - left / IDLE_S)} />
            </svg>
            <span>{left}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
