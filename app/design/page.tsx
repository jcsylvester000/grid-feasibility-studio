import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { contrast, palette, usedPairs } from "@/lib/design/tokens";
import { shortlist } from "@/lib/design/shortlist";

export const metadata: Metadata = { title: "Design tokens", robots: { index: false, follow: false } };

export default function DesignBoard() {
  return (
    <main className="container-page space-y-14 py-12">
      <header className="space-y-2">
        <p className="eyebrow">Internal · B0-02 and B0-13</p>
        <h1 className="text-4xl">Design tokens and shortlist</h1>
        <p className="max-w-2xl text-muted">
          GRID brand tokens as Tailwind theme values, the contrast check behind them, and the component shortlist for
          your approval.
        </p>
      </header>

      <section aria-labelledby="palette" className="space-y-4">
        <h2 id="palette" className="text-2xl">Palette</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Object.entries(palette).map(([name, hex]) => (
            <li key={name} className="overflow-hidden rounded-lg border border-line bg-white">
              <div className="h-14" style={{ background: hex }} />
              <div className="p-2 text-xs">
                <div className="font-medium">{name}</div>
                <div className="font-mono text-muted">{hex}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="contrast" className="space-y-4">
        <h2 id="contrast" className="text-2xl">Contrast (WCAG 2.2 AA needs 4.5:1)</h2>
        <div tabIndex={0} className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-muted">
              <tr><th className="py-2">Use</th><th>Sample</th><th>Ratio</th></tr>
            </thead>
            <tbody>
              {usedPairs.map(([fg, bg, use]) => (
                <tr key={use} className="border-t border-line">
                  <td className="py-2">{use}</td>
                  <td><span className="rounded px-2 py-1" style={{ color: palette[fg], background: palette[bg] }}>{fg} on {bg}</span></td>
                  <td className="font-mono">{contrast(palette[fg], palette[bg])}:1</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="type" className="space-y-3">
        <h2 id="type" className="text-2xl">Type</h2>
        <p className="font-display text-5xl">Cantata One headings</p>
        <p className="text-lg">Poppins body text, 400 / <span className="font-medium">500</span> / <span className="font-semibold">600</span>.</p>
        <p className="eyebrow">Eyebrow label</p>
      </section>

      <section aria-labelledby="controls" className="space-y-4">
        <h2 id="controls" className="text-2xl">Buttons and chips</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="dark">Dark</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Draft</Badge>
          <Badge tone="info">Running</Badge>
          <Badge tone="warn">Needs confirmation</Badge>
          <Badge tone="ok">Ready</Badge>
          <Badge tone="bad">Failed</Badge>
          <Badge tone="brand">Estimate</Badge>
        </div>
        <div className="rounded-xl bg-navy p-6">
          <Button variant="ghost-light">Ghost on navy</Button>
        </div>
      </section>

      <section aria-labelledby="shortlist" className="space-y-4">
        <h2 id="shortlist" className="text-2xl">Component shortlist (for approval)</h2>
        <p className="max-w-3xl text-sm text-muted">
          21st.dev items are copied into the repo and restyled with these tokens. HorizonX needs a membership, so it is a
          visual reference unless you share exported files. Public pages stay under 70 KB of JavaScript, so no WebGL there.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {shortlist.map((s) => (
            <Card key={s.area} className="space-y-3 p-5">
              <h3 className="text-xl">{s.area}</h3>
              <p className="text-sm text-muted">{s.direction}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {s.candidates.map((c) => (
                  <li key={c.href + c.label}>
                    <a href={c.href} target="_blank" rel="noreferrer">{c.label}</a>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
