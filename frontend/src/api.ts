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
  aliases: string[]; range_min: number | null; company_devices: number; edits: number; updated_at: string | null;
}
export interface ReceiptOut { id: number; receipt_no: string; serial: string; qr_text: string; qr_svg: string }

/** PI-06 등록 · 수정에 보내는 값 */
export interface DeviceForm {
  company: string; aliases: string[]; model: string; serial: string; approval_no: string;
  max_range: number; range_min: number | null; last_receipt_no: string | null; pitots: string[];
}
export interface CompanyRow { id: number; name: string; aliases: string[]; devices: number }
export interface Stats { devices: number; companies: number; approvals: number; receipts_today: number }

export function send<T>(path: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  return api<T>(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export const createReceipt = (device_id: number, receipt_no: string) => send<ReceiptOut>("/receipts", "POST", { device_id, receipt_no });
