"use client";
// Small hand-built SVG charts (no chart library): thin marks, rounded data ends, recessive grid,
// legend + selective direct labels, hover tooltips, and every chart has a table view beside it.
import * as React from "react";
import { cn } from "@/components/ui/cn";

export const SERIES = { a: "var(--color-s1)", b: "var(--color-s2)" } as const;

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T | null>(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Horizontal bar with only the data end rounded (anchored to the baseline). */
function hbar(x: number, y: number, w: number, h: number, r = 3): string {
  if (w <= 0) return "";
  const rr = Math.min(r, w, h / 2);
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}
function vbar(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.dashed ? "transparent" : i.color, outline: i.dashed ? `1.5px dashed ${i.color}` : undefined }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: React.ReactNode }) {
  const left = Math.min(Math.max(8, x + 12), Math.max(8, width - 200));
  return (
    <div role="status" className="pointer-events-none absolute z-10 w-[188px] rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg" style={{ left, top: Math.max(0, y - 10) }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- Grouped horizontal bars
export interface GroupRow {
  label: string;
  a: number;
  b: number;
  aText: string; // display value (may be "<11")
  bText: string;
  aSuppressed?: boolean;
  bSuppressed?: boolean;
  note?: string;
}

export function GroupedBars({ rows, aName, bName, labelWidth = 168 }: { rows: GroupRow[]; aName: string; bName: string; labelWidth?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = React.useState<number | null>(null);
  const rowH = 38;
  const barH = 11;
  const gap = 2;
  const top = 4;
  const valueW = 40;
  const plotW = Math.max(60, width - labelWidth - valueW);
  const max = niceMax(Math.max(...rows.map((r) => Math.max(r.a, r.b)), 1));
  const sx = (v: number) => (v / max) * plotW;
  const h = top + rows.length * rowH + 4;
  const ticks = [0, max / 2, max];

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 ? (
        <svg width={width} height={h} role="img" aria-label={`${aName} and ${bName} by source`} className="block">
          {ticks.map((t) => (
            <line key={t} x1={labelWidth + sx(t)} x2={labelWidth + sx(t)} y1={0} y2={h - 2} stroke="var(--color-grid)" />
          ))}
          {rows.map((r, i) => {
            const y = top + i * rowH;
            const yA = y + (rowH - (barH * 2 + gap)) / 2;
            const yB = yA + barH + gap;
            const active = hover === i;
            const supW = sx(10);
            return (
              <g key={r.label} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${r.label}: ${aName} ${r.aText}, ${bName} ${r.bText}`}>
                <rect x={0} y={y} width={width} height={rowH} fill={active ? "var(--color-sunken)" : "transparent"} rx={4} />
                <text x={labelWidth - 10} y={y + rowH / 2} dominantBaseline="middle" textAnchor="end" fontSize={12.5} fill="var(--color-ink)">
                  {r.label}
                </text>
                {r.aSuppressed ? (
                  <rect x={labelWidth} y={yA} width={supW} height={barH} fill="none" stroke={SERIES.a} strokeDasharray="3 2" rx={2} />
                ) : (
                  <path d={hbar(labelWidth, yA, sx(r.a), barH)} fill={SERIES.a} />
                )}
                {r.bSuppressed ? (
                  <rect x={labelWidth} y={yB} width={supW} height={barH} fill="none" stroke={SERIES.b} strokeDasharray="3 2" rx={2} />
                ) : (
                  <path d={hbar(labelWidth, yB, sx(r.b), barH)} fill={SERIES.b} />
                )}
                <text x={labelWidth + (r.aSuppressed ? supW : sx(r.a)) + 6} y={yA + barH / 2} dominantBaseline="middle" fontSize={11} fill="var(--color-ink-2)" className="tabular">{r.aText}</text>
                <text x={labelWidth + (r.bSuppressed ? supW : sx(r.b)) + 6} y={yB + barH / 2} dominantBaseline="middle" fontSize={11} fill="var(--color-ink-2)" className="tabular">{r.bText}</text>
              </g>
            );
          })}
        </svg>
      ) : (
        <div style={{ height: h }} />
      )}
      {hover !== null && width > 0 ? (
        <Tooltip x={labelWidth + sx(Math.max(rows[hover].a, rows[hover].b))} y={top + hover * rowH} width={width}>
          <p className="font-semibold text-ink">{rows[hover].label}</p>
          <p className="mt-1 flex justify-between"><span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: SERIES.a }} />{aName}</span><b className="tabular">{rows[hover].aText}</b></p>
          <p className="flex justify-between"><span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: SERIES.b }} />{bName}</span><b className="tabular">{rows[hover].bText}</b></p>
          {rows[hover].note ? <p className="mt-1 text-ink-3">{rows[hover].note}</p> : null}
        </Tooltip>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Two-line trend
export function TrendLines({ labels, a, b, aName, bName, height = 220 }: { labels: string[]; a: number[]; b: number[]; aName: string; bName: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = React.useState<number | null>(null);
  const pad = { l: 30, r: 118, t: 12, b: 26 };
  const plotW = Math.max(100, width - pad.l - pad.r);
  const plotH = height - pad.t - pad.b;
  const max = niceMax(Math.max(...a, ...b, 1));
  const x = (i: number) => pad.l + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * plotW);
  const y = (v: number) => pad.t + plotH - (v / max) * plotH;
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ticks = [0, max / 2, max];
  const last = labels.length - 1;
  // Keep end labels from colliding.
  let ya = y(a[last]);
  let yb = y(b[last]);
  if (Math.abs(ya - yb) < 16) { const mid = (ya + yb) / 2; ya = mid - 8; yb = mid + 8; }

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const box = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - box.left;
    const i = Math.round((px / box.width) * last);
    setHover(Math.max(0, Math.min(last, i)));
  };

  return (
    <div ref={ref} className="relative">
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={`${aName} and ${bName} by week`} className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={pad.l + plotW} y1={y(t)} y2={y(t)} stroke="var(--color-grid)" />
              <text x={pad.l - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10.5} fill="var(--color-ink-3)" className="tabular">{t}</text>
            </g>
          ))}
          {labels.map((l, i) => (i % 2 === 0 || i === last ? <text key={l + i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={10.5} fill="var(--color-ink-3)">{l}</text> : null))}
          <path d={line(a)} fill="none" stroke={SERIES.a} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={line(b)} fill="none" stroke={SERIES.b} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(last)} cy={y(a[last])} r={4} fill={SERIES.a} stroke="var(--color-surface)" strokeWidth={2} />
          <circle cx={x(last)} cy={y(b[last])} r={4} fill={SERIES.b} stroke="var(--color-surface)" strokeWidth={2} />
          <text x={x(last) + 10} y={ya} dominantBaseline="middle" fontSize={11.5} fill="var(--color-ink)">{aName} <tspan fontWeight={600} className="tabular">{a[last]}</tspan></text>
          <text x={x(last) + 10} y={yb} dominantBaseline="middle" fontSize={11.5} fill="var(--color-ink)">{bName} <tspan fontWeight={600} className="tabular">{b[last]}</tspan></text>
          {hover !== null ? (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + plotH} stroke="var(--color-ink-3)" strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(a[hover])} r={4.5} fill={SERIES.a} stroke="var(--color-surface)" strokeWidth={2} />
              <circle cx={x(hover)} cy={y(b[hover])} r={4.5} fill={SERIES.b} stroke="var(--color-surface)" strokeWidth={2} />
            </g>
          ) : null}
          <rect x={pad.l} y={pad.t} width={plotW} height={plotH} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {hover !== null && width > 0 ? (
        <Tooltip x={x(hover)} y={pad.t} width={width}>
          <p className="font-semibold text-ink">Week of {labels[hover]}</p>
          <p className="mt-1 flex justify-between"><span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: SERIES.a }} />{aName}</span><b className="tabular">{a[hover]}</b></p>
          <p className="flex justify-between"><span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: SERIES.b }} />{bName}</span><b className="tabular">{b[hover]}</b></p>
          <p className="mt-1 text-ink-3">Connection rate {a[hover] ? Math.round((b[hover] / a[hover]) * 100) : 0}%</p>
        </Tooltip>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Histogram (single series)
export function Histogram({ buckets, markerAfter, markerLabel, height = 206, unit = "referrals", label = "Distribution of time to first contact" }: { buckets: { label: string; n: number }[]; markerAfter?: number; markerLabel?: string; height?: number; unit?: string; label?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = React.useState<number | null>(null);
  const pad = { l: 8, r: 8, t: 44, b: 26 };
  const plotW = Math.max(100, width - pad.l - pad.r);
  const plotH = height - pad.t - pad.b;
  const max = Math.max(...buckets.map((b) => b.n), 1);
  const slot = plotW / buckets.length;
  const bw = Math.min(56, slot - 10);
  const total = buckets.reduce((a, b) => a + b.n, 0);
  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={label} className="block">
          <line x1={pad.l} x2={pad.l + plotW} y1={pad.t + plotH} y2={pad.t + plotH} stroke="var(--color-line)" />
          {buckets.map((b, i) => {
            const h = (b.n / max) * plotH;
            const cx = pad.l + slot * i + slot / 2;
            return (
              <g key={b.label} onMouseEnter={() => setHover(i)} tabIndex={0} aria-label={`${b.label}: ${b.n} ${unit}`}>
                <rect x={pad.l + slot * i} y={pad.t} width={slot} height={plotH + pad.b} fill={hover === i ? "var(--color-sunken)" : "transparent"} />
                <path d={vbar(cx - bw / 2, pad.t + plotH - h, bw, h)} fill={SERIES.a} />
                <text x={cx} y={pad.t + plotH - h - 6} textAnchor="middle" fontSize={11} fill="var(--color-ink-2)" className="tabular">{b.n}</text>
                <text x={cx} y={height - 8} textAnchor="middle" fontSize={10.5} fill="var(--color-ink-3)">{b.label}</text>
              </g>
            );
          })}
          {markerAfter !== undefined ? (
            <g pointerEvents="none">
              <line x1={pad.l + slot * (markerAfter + 1)} x2={pad.l + slot * (markerAfter + 1)} y1={20} y2={pad.t + plotH} stroke="var(--color-ink)" strokeDasharray="4 3" />
              <text x={Math.min(pad.l + plotW - 70, Math.max(70, pad.l + slot * (markerAfter + 1)))} y={12} textAnchor="middle" fontSize={11} fill="var(--color-ink)" fontWeight={600}>{markerLabel}</text>
            </g>
          ) : null}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {hover !== null && width > 0 ? (
        <Tooltip x={pad.l + slot * hover + slot / 2} y={pad.t} width={width}>
          <p className="font-semibold text-ink">{buckets[hover].label}</p>
          <p className="mt-1">{buckets[hover].n} {unit} ({Math.round((buckets[hover].n / total) * 100)}%)</p>
        </Tooltip>
      ) : null}
    </div>
  );
}

/** Chart / Table switch used on every chart panel (accessibility: a table view always exists). */
export function ViewToggle({ value, onChange }: { value: "chart" | "table"; onChange: (v: "chart" | "table") => void }) {
  return (
    <div className="inline-flex rounded-md border border-line p-0.5 text-xs" role="group" aria-label="View">
      {(["chart", "table"] as const).map((v) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={cn("rounded px-2 py-0.5 capitalize", value === v ? "bg-sunken font-medium text-ink" : "text-ink-3 hover:text-ink")}>
          {v}
        </button>
      ))}
    </div>
  );
}
