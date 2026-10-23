/** Pi 내부 API (127.0.0.1:8000/api) 호출 */
export interface DeviceRow { id: number; company: string; model: string; serial: string; last_receipt_no: string | null }

export class ApiError extends Error {}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError("Pi 서버에 연결할 수 없어요. 잠시 뒤 다시 시도하세요.");
  }
  if (!res.ok) {
    let msg = `요청 실패 (${res.status})`;
    try {
      const j = await res.json();
      if (typeof j.detail === "string") msg = j.detail;
    } catch {
      /* 본문 없음 */
    }
    throw new ApiError(msg);
  }
  return res.json() as Promise<T>;
}

export interface DeviceDetail {
  id: number; company: string; model: string; serial: string; approval_no: string | null;
  max_range: number; last_receipt_no: string | null; pitots: string[];
}
export interface ReceiptOut { id: number; receipt_no: string; serial: string; qr_text: string; qr_svg: string }
