import { sampleReport as s } from "@/content/site";
import { formatNumber, formatPHP } from "@/lib/format";

/** Static "Sample" Quick Report card for the Home hero (no JavaScript). */
export function SampleReportCard() {
  const pos = Math.min(100, Math.max(0, ((s.askingPerSqm - s.compLow) / (s.compHigh - s.compLow)) * 100));
  return (
    <figure
      aria-label="Sample Quick Report"
      className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white p-5 text-ink shadow-2xl sm:p-6"
    >
      <span className="absolute -top-3 right-5 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-navy">
        {s.label}
      </span>
      <p className="eyebrow">{s.product}</p>
      <h2 className="mt-2 text-xl leading-snug">{s.title}</h2>
      <div className="mt-4 flex items-center gap-3">
        <span className="rounded-full bg-warn-soft px-3 py-1 text-sm font-semibold text-warn">{s.rating}</span>
        <span className="text-sm text-muted">{s.ratingNote}</span>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted">Asking price</dt>
          <dd className="text-lg font-semibold">{formatPHP(s.askingPerSqm)}/sqm</dd>
        </div>
        <div>
          <dt className="text-muted">Lot area</dt>
          <dd className="text-lg font-semibold">about {formatNumber(s.lotAreaSqm)} sqm</dd>
        </div>
      </dl>
      <div className="mt-5" aria-hidden>
        <div className="relative h-2.5 rounded-full bg-gradient-to-r from-ok-soft via-warn-soft to-bad-soft">
          <span
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-navy shadow"
            style={{ left: `${pos}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{formatPHP(s.compLow)}</span>
          <span>Comparable listings</span>
          <span>{formatPHP(s.compHigh)}</span>
        </div>
      </div>
      <p className="sr-only">
        Asking {formatPHP(s.askingPerSqm)} per sqm sits inside the comparable range of {formatPHP(s.compLow)} to{" "}
        {formatPHP(s.compHigh)}.
      </p>
      <figcaption className="mt-5 border-t border-line pt-3 text-xs text-muted">
        Sources dated {s.asOf}. {s.footnote}
      </figcaption>
    </figure>
  );
}
