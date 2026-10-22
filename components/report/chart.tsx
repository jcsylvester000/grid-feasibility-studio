/**
 * Server-rendered SVG charts (no chart library, no client JavaScript). Supports the ChartBlock types:
 * line, bar, stacked_bar, range, scatter, waterfall.
 */
import { formatValue } from "@/lib/report/format";

type Series = { name: string; values: (number | null)[] };
type Props = {
  chartType: "line" | "bar" | "stacked_bar" | "range" | "scatter" | "waterfall";
  title: string;
  x: { label: string; values: (string | number)[] };
  series: Series[];
  yUnit?: string;
};

const COLORS = ["#1c335e", "#be8562", "#2a744a", "#94590a", "#5b6472", "#b23a3a"];
const W = 640;
const H = 260;
const PAD = { l: 64, r: 16, t: 16, b: 40 };

export function SvgChart({ chartType, title, x, series, yUnit = "" }: Props) {
  const n = x.values.length;
  const valuesAt = (i: number) => series.map((s) => s.values[i] ?? 0);
  let ys: number[] = [];
  let waterfall: { start: number; end: number }[] = [];
  if (chartType === "stacked_bar") ys = x.values.flatMap((_, i) => [0, valuesAt(i).reduce((a, b) => a + Math.max(b, 0), 0), valuesAt(i).reduce((a, b) => a + Math.min(b, 0), 0)]);
  else if (chartType === "waterfall") {
    let acc = 0;
    waterfall = (series[0]?.values ?? []).map((v) => {
      const start = acc;
      acc += v ?? 0;
      return { start, end: acc };
    });
    ys = waterfall.flatMap((w) => [w.start, w.end, 0]);
  } else ys = series.flatMap((s) => s.values.filter((v): v is number => v !== null)).concat(0);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const Y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - (v - min) / span);
  const band = (W - PAD.l - PAD.r) / Math.max(n, 1);
  // Thin the x labels so they never overlap (about 60 px per label).
  const labelEvery = Math.max(1, Math.ceil(n / Math.floor((W - PAD.l - PAD.r) / 60)));
  const X = (i: number) => PAD.l + band * i + band / 2;
  const ticks = [min, min + span / 2, max];
  const fmt = (v: number) => formatValue(Math.round(v * 100) / 100, yUnit);

  return (
    <figure className="overflow-x-auto" tabIndex={0}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="h-auto w-full min-w-[480px]">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(t)} y2={Y(t)} stroke="#e3ddd3" />
            <text x={PAD.l - 6} y={Y(t) + 4} textAnchor="end" fontSize="10" fill="#5b6472">
              {fmt(t)}
            </text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={Y(0)} y2={Y(0)} stroke="#5b6472" />
        {x.values.map((label, i) => (i % labelEvery !== 0 ? null : (
          <text key={i} x={X(i)} y={H - PAD.b + 16} textAnchor="middle" fontSize="10" fill="#5b6472">
            {String(label)}
          </text>
        )))}

        {(chartType === "bar" || chartType === "range") &&
          series.map((s, si) =>
            s.values.map((v, i) => {
              if (v === null) return null;
              const w = (band * 0.7) / series.length;
              const left = PAD.l + band * i + band * 0.15 + w * si;
              return <rect key={`${si}-${i}`} x={left} width={w} y={Math.min(Y(v), Y(0))} height={Math.abs(Y(v) - Y(0))} fill={COLORS[si % COLORS.length]} />;
            }),
          )}
        {chartType === "stacked_bar" &&
          x.values.map((_, i) => {
            let pos = 0;
            let neg = 0;
            return series.map((s, si) => {
              const v = s.values[i] ?? 0;
              const base = v >= 0 ? pos : neg;
              const top = base + v;
              if (v >= 0) pos = top;
              else neg = top;
              return <rect key={`${si}-${i}`} x={PAD.l + band * i + band * 0.2} width={band * 0.6} y={Math.min(Y(base), Y(top))} height={Math.abs(Y(top) - Y(base))} fill={COLORS[si % COLORS.length]} />;
            });
          })}
        {chartType === "waterfall" &&
          waterfall.map((w, i) => (
            <rect key={i} x={PAD.l + band * i + band * 0.2} width={band * 0.6} y={Math.min(Y(w.start), Y(w.end))} height={Math.max(1, Math.abs(Y(w.end) - Y(w.start)))} fill={w.end >= w.start ? "#2a744a" : "#b23a3a"} />
          ))}
        {(chartType === "line" || chartType === "scatter") &&
          series.map((s, si) => {
            const pts = s.values.map((v, i) => (v === null ? null : ([X(i), Y(v)] as const))).filter(Boolean) as (readonly [number, number])[];
            return (
              <g key={si}>
                {chartType === "line" && <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={COLORS[si % COLORS.length]} strokeWidth="2" />}
                {pts.map(([cx, cy], i) => (
                  <circle key={i} cx={cx} cy={cy} r="3" fill={COLORS[si % COLORS.length]} />
                ))}
              </g>
            );
          })}
      </svg>
      {series.length > 1 && (
        <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
          {series.map((s, si) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: COLORS[si % COLORS.length] }} />
              {s.name}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
