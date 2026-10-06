// ตัวเรียก API ฝั่ง client — แปลง response รูป { data } / { error } ของระบบเป็นผลลัพธ์ที่ใช้ต่อได้ทันที

export type ApiFailure = { code: string; message: string; fields?: Record<string, string> };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

/** เรียก API ของระบบเอง ส่ง/รับ JSON — ไม่โยน error ให้ฟอร์มเอาไปแสดงต่อได้เลย */
export async function apiFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (res.status === 204) return { ok: true, data: undefined as T };
    const json = await res.json();
    return res.ok ? { ok: true, data: json.data } : { ok: false, error: json.error };
  } catch {
    return {
      ok: false,
      error: { code: "NETWORK", message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่" },
    };
  }
}
