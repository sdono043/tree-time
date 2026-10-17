"use client";

import { useState } from "react";
import { niceTicks, useWidth } from "./useWidth";

const H = 200;
const M = { top: 12, right: 8, bottom: 28, left: 36 };

export function BarChart({
  labels,
  values,
  color,
  format,
  axisFormat = format,
  detail,
  ariaLabel,
}: {
  labels: string[];
  values: number[];
  color: string;
  format: (n: number) => string;
  axisFormat?: (n: number) => string;
  detail?: (i: number) => string;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(0, Math.max(...values, 1));
  const yMax = ticks[ticks.length - 1];
  const iw = width - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const band = iw / values.length;
  const barW = Math.min(36, band - 2); // keeps a ≥2px surface gap between bars
  const y = (v: number) => M.top + ih - (v / yMax) * ih;
  const labelEvery = Math.ceil(values.length / Math.max(2, Math.floor(iw / 52)));

  return (
    <div>
      <div ref={ref} className="relative min-w-0 overflow-hidden">
        <svg width={width} height={H} role="img" aria-label={ariaLabel} className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
              <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular">{axisFormat(t)}</text>
            </g>
          ))}
          {values.map((v, i) => {
            const cx = M.left + band * i + band / 2;
            const h = Math.max(0, y(0) - y(v));
            const r = Math.min(4, h, barW / 2);
            const x0 = cx - barW / 2;
            const top = y(v);
            // Rounded data-end at the top, square at the baseline.
            const d = `M${x0},${y(0)}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + barW - r}Q${x0 + barW},${top} ${x0 + barW},${top + r}V${y(0)}Z`;
            return (
              <g key={labels[i]}>
                <path d={d} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} />
                {(i % labelEvery === 0 || i === values.length - 1) && (
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">{labels[i]}</text>
                )}
                <rect
                  x={M.left + band * i}
                  y={M.top}
                  width={band}
                  height={ih}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${labels[i]}: ${format(v)}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="outline-none"
                />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 w-[150px] rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm"
            style={{ left: Math.min(Math.max(M.left + band * hover + band / 2 - 75, 0), width - 150) }}
          >
            <div className="text-muted">Week of {labels[hover]}</div>
            <strong className="tabular">{format(values[hover])}</strong>
            {detail && <div className="text-ink-2 tabular">{detail(hover)}</div>}
          </div>
        )}
      </div>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted">View as table</summary>
        <table className="mt-2 w-full tabular">
          <tbody>
            {labels.map((l, i) => (
              <tr key={l} className="border-t border-line">
                <td className="py-1 pr-3">{l}</td>
                <td className="py-1 pr-3 text-right">{format(values[i])}</td>
                {detail && <td className="py-1 text-right text-ink-2">{detail(i)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
