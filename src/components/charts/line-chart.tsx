"use client";

import { useState } from "react";
import { formatThaiDate } from "@/lib/dates";

type Point = { date: string; count: number };

const W = 640;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 28, left: 36 };

/** เพดานแกน y แบบตัวเลขกลม ๆ (อย่างน้อย 4 ให้มีขีดแบ่ง) */
function niceMax(max: number) {
  if (max <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / step) * step;
}

/**
 * กราฟเส้นชุดเดียว (ผู้ใช้ใหม่รายวัน) — สเปก dataviz: เส้น 2px, พื้นใต้เส้น 10%, จุดปลาย ≥ 8px มีวงแหวนสีพื้น,
 * grid เส้นบางสีจาง, hover/โฟกัสแล้วมีเส้นตั้ง + tooltip, และตารางซ่อนให้ screen reader อ่านค่าครบ
 */
export function LineChart({ data, label }: { data: Point[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.count), 0));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join("");
  const area = `${line}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const ticks = [0, max / 2, max];
  const last = data.length - 1;
  const active = hover ?? null;

  /** หาจุดที่ใกล้ตำแหน่งเมาส์ที่สุด */
  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / innerW) * (data.length - 1));
    setHover(Math.min(Math.max(i, 0), last));
  }

  return (
    <figure className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label={`${label} ${data.length} วันล่าสุด รวม ${data.reduce((s, d) => s + d.count, 0)} คน`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-text-muted text-[11px]">
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}
        {[0, Math.floor(last / 2), last].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
            className="fill-text-muted text-[11px]"
          >
            {formatThaiDate(data[i].date)}
          </text>
        ))}
        <path d={area} fill="var(--paid)" opacity={0.1} />
        <path
          d={line}
          fill="none"
          stroke="var(--paid)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {active !== null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={PAD.top}
            y2={y(0)}
            stroke="var(--line-strong)"
            strokeWidth={1}
          />
        )}
        <circle
          cx={x(active ?? last)}
          cy={y(data[active ?? last].count)}
          r={5}
          fill="var(--paid)"
          stroke="var(--night)"
          strokeWidth={2}
        />
      </svg>
      {active !== null && (
        <figcaption
          className="pointer-events-none absolute top-0 rounded-control border border-line bg-surface px-3 py-1.5 text-caption whitespace-nowrap"
          style={{
            left: `${(x(active) / W) * 100}%`,
            transform: `translateX(${active > last / 2 ? "-105%" : "5%"})`,
          }}
        >
          {formatThaiDate(data[active].date)} · <span className="figure">{data[active].count}</span> คน
        </figcaption>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">วันที่</th>
            <th scope="col">จำนวน</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{formatThaiDate(d.date)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
