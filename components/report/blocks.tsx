/**
 * Block renderer registry (BRD 8.1 rule 3): one component per block type in common.schema.json.
 * Unknown types cannot occur in a validated envelope; they render nothing.
 */
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { COVERAGE_LABELS, formatFigure, type Figure } from "@/lib/report/format";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SvgChart } from "./chart";
import { Fig, SourceRefs, StatusChip } from "./primitives";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Block = { type: string; [k: string]: any };

const isFigure = (v: unknown): v is Figure => !!v && typeof v === "object" && "unit" in (v as object) && "status" in (v as object);

function cellText(v: unknown, format?: string): React.ReactNode {
  if (v === null || v === undefined || v === "") return <span className="text-muted">—</span>;
  if (isFigure(v)) return <Fig f={v} compact />;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") {
    if (format === "currency") return formatFigure({ value: v, range: null, unit: "PHP", as_of: null, status: "", source_ids: [] });
    if (format === "percent") return `${v}%`;
    return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(v);
  }
  if (format === "date" && /^\d{4}-\d{2}-\d{2}/.test(String(v))) return formatDate(String(v).slice(0, 10));
  if (format === "status") return <StatusChip status={String(v)} />;
  return String(v);
}

function Paragraph({ b }: { b: Block }) {
  return <p className="leading-relaxed text-ink-2">{b.text}</p>;
}

function KpiStrip({ b }: { b: Block }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3" data-block="kpi_strip">
      {b.items.map((it: { label: string; figure: Figure; hint?: string }) => (
        <div key={it.label} className="rounded-xl border border-line bg-white p-4 print:break-inside-avoid">
          <dt className="text-xs uppercase tracking-wide text-muted">{it.label}</dt>
          <dd className="mt-1 text-lg">
            <Fig f={it.figure} compact />
          </dd>
          {it.hint && <dd className="mt-1 text-xs text-muted">{it.hint}</dd>}
          <dd className="mt-2">
            <StatusChip status={it.figure.status} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Table({ b }: { b: Block }) {
  return (
    <figure className="print:break-inside-avoid">
      <figcaption className="mb-2 font-medium">
        {b.title}
        <SourceRefs ids={b.source_ids} />
      </figcaption>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="bg-sand text-muted">
            <tr>
              {b.columns.map((c: { key: string; label: string; align?: string }) => (
                <th key={c.key} scope="col" className={cn("px-3 py-2 font-medium", c.align === "right" && "text-right", c.align === "center" && "text-center")}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r: Record<string, unknown>, i: number) => (
              <tr key={i} className="border-t border-line align-top">
                {b.columns.map((c: { key: string; align?: string; format?: string }) => (
                  <td key={c.key} className={cn("px-3 py-2", c.align === "right" && "text-right tabular-nums", c.align === "center" && "text-center")}>
                    {cellText(r[c.key], c.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {b.caption && <p className="mt-2 text-xs text-muted">{b.caption}</p>}
    </figure>
  );
}

function Chart({ b }: { b: Block }) {
  return (
    <figure className="rounded-xl border border-line bg-white p-4 print:break-inside-avoid">
      <figcaption className="mb-3 font-medium">
        {b.title}
        <SourceRefs ids={b.source_ids} />
      </figcaption>
      <SvgChart chartType={b.chart_type} title={b.title} x={b.x} series={b.series} yUnit={b.y_unit} />
      {b.annotations?.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-muted">
          {b.annotations.map((a: { at: string | number; text: string }, i: number) => (
            <li key={i}>
              {String(a.at)}: {a.text}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">{b.caption}</p>
    </figure>
  );
}

const CALLOUT = {
  info: { cls: "border-info/30 bg-info-soft text-ink", Icon: Info, icon: "text-info" },
  success: { cls: "border-ok/30 bg-ok-soft text-ink", Icon: CheckCircle2, icon: "text-ok" },
  warning: { cls: "border-warn/30 bg-warn-soft text-ink", Icon: AlertTriangle, icon: "text-warn" },
  risk: { cls: "border-bad/30 bg-bad-soft text-ink", Icon: ShieldAlert, icon: "text-bad" },
} as const;

function Callout({ b }: { b: Block }) {
  const c = CALLOUT[b.tone as keyof typeof CALLOUT] ?? CALLOUT.info;
  return (
    <aside className={cn("flex gap-3 rounded-xl border p-4 print:break-inside-avoid", c.cls)} data-block="callout">
      <c.Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", c.icon)} />
      <div>
        {b.title && <p className="font-medium">{b.title}</p>}
        <p className="text-sm leading-relaxed">{b.text}</p>
      </div>
    </aside>
  );
}

function Checklist({ b }: { b: Block }) {
  return (
    <div className="print:break-inside-avoid">
      <p className="mb-2 font-medium">{b.title}</p>
      <ul className="divide-y divide-line rounded-xl border border-line bg-white">
        {b.items.map((it: { label: string; result?: string; status: string; source_ids?: string[]; next_step?: string }, i: number) => (
          <li key={i} className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto]">
            <div>
              <p className="font-medium">
                {it.label}
                <SourceRefs ids={it.source_ids} />
              </p>
              {it.result && <p className="text-sm text-ink-2">{it.result}</p>}
              {it.next_step && <p className="mt-1 text-xs text-muted">Next step: {it.next_step}</p>}
            </div>
            <div className="sm:text-right">
              <StatusChip status={it.status} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Static map: marker positions plotted around the centre plus an OpenStreetMap link (no third-party scripts). */
function MapView({ b }: { b: Block }) {
  const { lat, lng } = b.center as { lat: number; lng: number };
  const markers = (b.markers ?? []) as { lat: number; lng: number; label: string; kind?: string }[];
  const pts = [{ lat, lng, label: "Centre" }, ...markers];
  const dLat = Math.max(0.002, ...pts.map((p) => Math.abs(p.lat - lat)));
  const dLng = Math.max(0.002, ...pts.map((p) => Math.abs(p.lng - lng)));
  const X = (v: number) => 50 + ((v - lng) / dLng) * 42;
  const Y = (v: number) => 50 - ((v - lat) / dLat) * 42;
  const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${b.zoom ?? 15}/${lat}/${lng}`;
  return (
    <figure className="rounded-xl border border-line bg-white p-4 print:break-inside-avoid">
      <svg viewBox="0 0 100 100" className="h-48 w-full rounded-lg bg-sand" role="img" aria-label={`Map around ${lat.toFixed(4)}, ${lng.toFixed(4)}`}>
        <circle cx={50} cy={50} r={2.5} fill="#0e192f" />
        {markers.map((m, i) => (
          <g key={i}>
            <circle cx={X(m.lng)} cy={Y(m.lat)} r={1.8} fill="#be8562" />
            <text x={X(m.lng) + 2.5} y={Y(m.lat) + 1} fontSize="3" fill="#243447">{m.label}</text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span>
          Centre {lat.toFixed(5)}, {lng.toFixed(5)}
          {b.layers?.length ? ` · layers: ${b.layers.join(", ")}` : ""}
        </span>
        <a href={osm} target="_blank" rel="noopener noreferrer nofollow">
          Open in OpenStreetMap
        </a>
      </figcaption>
    </figure>
  );
}

function InputsRequired({ b }: { b: Block }) {
  const who = b.owner === "owner_developer" ? "the owner or developer" : b.owner === "shared" ? "the owner and GRID" : "GRID";
  return (
    <div className="rounded-xl border border-dashed border-warn/50 bg-warn-soft/50 p-4" data-block="inputs_required">
      <p className="font-medium text-warn">{COVERAGE_LABELS.inputs_required}</p>
      <p className="mt-1 text-sm text-ink-2">{b.message ?? `This part needs inputs from ${who}.`}</p>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {b.fields.map((f: { key: string; label: string; example?: string }) => (
          <li key={f.key}>
            {f.label}
            {f.example && <span className="text-muted"> (e.g. {f.example})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const REGISTRY: Record<string, (p: { b: Block }) => React.ReactNode> = {
  paragraph: Paragraph,
  kpi_strip: KpiStrip,
  table: Table,
  chart: Chart,
  callout: Callout,
  checklist: Checklist,
  map: MapView,
  inputs_required: InputsRequired,
};

export const BLOCK_TYPES = Object.keys(REGISTRY);

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        const C = REGISTRY[b.type];
        return C ? <C key={i} b={b} /> : null;
      })}
    </div>
  );
}
