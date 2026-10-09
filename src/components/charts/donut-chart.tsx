import { ringSegments, roundPercents } from "@/lib/donut";
import { formatBaht } from "@/lib/money";

export type DonutDatum = { key: number; label: string; value: number; color: string };

// วงกลมสัดส่วน (part-to-whole) ไม่เกิน 6 ชิ้น — ไม่ต้องใช้ไลบรารีหรือ JS
// สเปกจาก dataviz: วงบาง, เว้นช่องสีพื้น 2px ระหว่างชิ้น, วาดชิ้นตามลำดับหมวด (สีติดหมวด ไม่ติดอันดับ)
// รายการด้านข้างเรียงมาก→น้อย มีชื่อ + ยอด + % เสมอ จึงไม่ต้องพึ่งสีอย่างเดียวและอ่านเป็นข้อความได้ทั้งชุด

const SIZE = 160;
const STROKE = 18;
const R = (SIZE - STROKE) / 2;
const GAP = 2; // px ตามเส้นรอบวง

/** วงกลมสัดส่วนพร้อมยอดตรงกลางและรายการด้านข้าง — ชี้ที่ชิ้นไหนชิ้นนั้นเด่น ชิ้นอื่นจางลง */
export function DonutChart({
  data,
  label,
  centerValue,
  centerLabel,
}: {
  data: DonutDatum[];
  label: string;
  centerValue: string;
  centerLabel: string;
}) {
  const values = data.map((d) => d.value);
  const pct = roundPercents(values);
  const ring = ringSegments(values, R, GAP);
  const circumference = ring.circumference;
  const segments = data.map((d, i) => ({ ...d, pct: pct[i], ...ring.segments[i] }));
  const legend = [...segments].sort((a, b) => b.value - a.value);

  return (
    <figure className="glass flex flex-col items-center gap-5 rounded-card p-5 sm:flex-row sm:gap-7 md:p-6">
      <div className="relative shrink-0">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="group size-40 -rotate-90"
          role="img"
          aria-label={`${label}: ${legend.map((s) => `${s.label} ${s.pct}%`).join(", ")}`}
        >
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--line)" strokeWidth={STROKE} />
          {segments.map((s) => (
            <circle
              key={s.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={STROKE}
              strokeDasharray={`${s.dash} ${circumference}`}
              strokeDashoffset={-s.offset}
              className="transition-opacity group-hover:opacity-35 hover:opacity-100!"
            >
              <title>{`${s.label}: ${formatBaht(s.value, { short: true })} ต่อเดือน (${s.pct}%)`}</title>
            </circle>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="figure text-lead font-semibold">{centerValue}</span>
          <span className="text-caption text-text-muted">{centerLabel}</span>
        </div>
      </div>

      <ul className="flex w-full min-w-0 flex-1 flex-col divide-y divide-line">
        {legend.map((s) => (
          <li key={s.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto_3rem] items-center gap-3 py-2.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="truncate text-caption text-text">{s.label}</span>
            <span className="figure text-right text-caption text-text">
              {formatBaht(s.value, { short: true })}
            </span>
            <span className="figure text-right text-caption text-text-muted">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
