import { formatBaht } from "@/lib/money";

export type BarDatum = { label: string; value: number };

/**
 * กราฟแท่งแนวนอนชุดเดียว (สัดส่วนตามหมวด, Top 10) — ไม่ต้องใช้ไลบรารีหรือ JS
 * สเปกจาก dataviz: แท่งบาง 12px ปลายมน 4px ฝั่งปลาย/เหลี่ยมฝั่งฐาน, สีเดียวไม่ต้องมี legend,
 * ตัวเลขใช้สีตัวอักษร (ไม่ใช่สีแท่ง) อยู่ท้ายแท่ง, เป็น <ul> ที่อ่านเป็นข้อความได้ทั้งชุด (แทนตาราง)
 */
export function BarList({
  data,
  format = "baht",
  unit,
  label,
}: {
  data: BarDatum[];
  format?: "baht" | "count";
  unit?: string;
  label: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  /** ข้อความตัวเลขท้ายแท่ง: เงินบาท หรือจำนวน */
  const show = (v: number) =>
    format === "baht" ? formatBaht(v, { short: true }) : v.toLocaleString("th-TH");

  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {data.map((d) => {
        const pct = max > 0 ? (d.value / max) * 100 : 0;
        return (
          <li
            key={d.label}
            title={`${d.label}: ${show(d.value)}${unit ? ` ${unit}` : ""}`}
            className="grid grid-cols-[minmax(5.5rem,30%)_minmax(0,1fr)] items-center gap-3"
          >
            <span className="line-clamp-2 text-caption leading-snug break-words text-text-muted">
              {d.label}
            </span>
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-3 min-w-1 rounded-r-[4px] bg-paid"
                style={{ width: `calc((100% - 5.5rem) * ${pct / 100})` }}
              />
              <span className="figure text-caption whitespace-nowrap text-text">
                {show(d.value)}
                {unit && <span className="font-sans text-text-muted"> {unit}</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
