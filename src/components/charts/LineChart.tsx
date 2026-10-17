"use client";

import { useState } from "react";
import { niceTicks, useWidth } from "./useWidth";

export interface Series {
  name: string;
  color: string; // CSS color, e.g. "var(--series-1)"
  values: number[];
}

const H = 240;
const M = { top: 12, right: 16, bottom: 28, left: 56 };

export function LineChart({
  labels,
  series,
  format,
  area = false,
  marker,
  ariaLabel,
}: {
  labels: string[];
  series: Series[];
  format: (n: number) => string;
  area?: boolean;
  marker?: { index: number; text: string };
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const all = series.flatMap((s) => s.values);
  const ticks = niceTicks(Math.min(...all), Math.max(...all));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const iw = width - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const x = (i: number) => M.left + (labels.length === 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => M.top + ih - ((v - yMin) / (yMax - yMin)) * ih;
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    const i = Math.round((px / box.width) * (labels.length - 1));
    setHover(Math.max(0, Math.min(labels.length - 1, i)));
  }

  const tipLeft = hover === null ? 0 : Math.min(Math.max(x(hover) - 100, 0), width - 200);
  const labelEvery = Math.ceil(labels.length / Math.max(2, Math.floor(iw / 60)));

  return (
    <div>
      {series.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-4 text-xs text-ink-2">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div ref={ref} className="relative min-w-0 overflow-hidden">
        <svg width={width} height={H} role="img" aria-label={ariaLabel} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke={t === 0 && yMin < 0 ? "var(--muted)" : "var(--grid)"} strokeWidth={1} />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular">{format(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => {
            const last = i === labels.length - 1;
            // Always label the last point; drop a regular tick that would crowd it.
            if (!last && (i % labelEvery !== 0 || labels.length - 1 - i < labelEvery)) return null;
            return (
              <text key={l} x={x(i)} y={H - 8} textAnchor={last ? "end" : i === 0 ? "start" : "middle"} fontSize={11} fill="var(--muted)">{l}</text>
            );
          })}
          {series.map((s) => (
            <g key={s.name}>
              {area && (
                <path d={`${path(s.values)}L${x(s.values.length - 1)},${y(Math.max(0, yMin))}L${x(0)},${y(Math.max(0, yMin))}Z`} fill={s.color} opacity={0.12} />
              )}
              <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          ))}
          {marker && (
            <g>
              <circle cx={x(marker.index)} cy={y(series[0].values[marker.index])} r={4.5} fill={series[0].color} stroke="var(--surface)" strokeWidth={2} />
              <text x={x(marker.index)} y={y(series[0].values[marker.index]) + 18} textAnchor="middle" fontSize={11} fill="var(--ink-2)">{marker.text}</text>
            </g>
          )}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ih} stroke="var(--muted)" strokeWidth={1} />
              {series.map((s) => (
                <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </g>
          )}
          <rect
            x={M.left}
            y={M.top}
            width={iw}
            height={ih}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute top-0 w-[200px] rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm" style={{ left: tipLeft }}>
            <div className="text-muted mb-1">{labels[hover]}</div>
            {series.map((s) => (
              <div key={s.name} className="flex items-center gap-2">
                <span aria-hidden className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
                <strong className="tabular">{format(s.values[hover])}</strong>
                <span className="text-ink-2 truncate">{s.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted">View as table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full tabular">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 pr-3 font-normal">Period</th>
                {series.map((s) => <th key={s.name} className="py-1 pr-3 font-normal text-right">{s.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={l} className="border-t border-line">
                  <td className="py-1 pr-3">{l}</td>
                  {series.map((s) => <td key={s.name} className="py-1 pr-3 text-right">{format(s.values[i])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
