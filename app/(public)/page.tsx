import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, FileSearch, Flag, MapPinned, ScanText, Timer, Zap } from "lucide-react";
import { home, products, site } from "@/content/site";
import { buttonVariants } from "@/components/ui/button";
import { SampleReportCard } from "@/components/site/sample-report-card";
import { isTeaserScanEnabled } from "@/lib/flags";
import { jsonLdProps } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: { absolute: `${site.name} · ${site.tagline}` },
  description: site.description,
  alternates: { canonical: "/" },
};

const productIcons = { quick_report: Zap, executive_summary: FileSearch, feasibility_report: CalendarCheck, teaser_intake: ScanText };
const whyIcons = [Flag, MapPinned, Timer];

export default function Home() {
  const shown = products.filter((p) => p.flag !== "teaser" || isTeaserScanEnabled());
  const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  return (
    <>
      <script
        {...jsonLdProps({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: site.owner,
          url: origin,
          logo: `${origin}/grid-logo.png`,
        })}
      />

      {/* Hero */}
      <section className="hero-bg relative overflow-hidden bg-navy text-white">
        <div className="container-page grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <p className="eyebrow !text-gold">{home.eyebrow}</p>
            <h1 className="mt-4 text-4xl leading-[1.1] sm:text-5xl lg:text-6xl">{home.headline}</h1>
            <p className="mt-5 max-w-xl text-lg text-mist">{home.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={home.primaryCta.href} className={buttonVariants({ size: "lg" })}>
                {home.primaryCta.label}
                <ArrowRight aria-hidden />
              </Link>
              <Link href={home.secondaryCta.href} className={buttonVariants({ variant: "ghost-light", size: "lg" })}>
                {home.secondaryCta.label}
              </Link>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <SampleReportCard />
          </div>
        </div>
      </section>

      {/* Products */}
      <section aria-labelledby="products" className="container-page py-16 sm:py-20">
        <h2 id="products" className="text-3xl sm:text-4xl">{home.productsTitle}</h2>
        <ul className={`mt-8 grid gap-4 sm:grid-cols-2 ${shown.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {shown.map((p) => {
            const Icon = productIcons[p.key];
            return (
              <li
                key={p.key}
                className="group flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-bronze-soft text-bronze-ink">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="mt-4 text-xl">{p.name}</h3>
                <p className="mt-2 flex-1 text-sm text-muted">{p.line}</p>
                <p className="mt-4 text-xs font-medium uppercase tracking-wide text-bronze-ink">{p.needs}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Why */}
      <section aria-labelledby="why" className="border-y border-line bg-white">
        <div className="container-page py-16 sm:py-20">
          <h2 id="why" className="sr-only">Why GRID Feasibility Studio</h2>
          <ul className="grid gap-10 md:grid-cols-3">
            {home.why.map((w, i) => {
              const Icon = whyIcons[i]!;
              return (
                <li key={w.title}>
                  <Icon aria-hidden className="size-6 text-bronze" />
                  <h3 className="mt-4 text-2xl">{w.title}</h3>
                  <p className="mt-2 text-muted">{w.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="container-page py-16 sm:py-20">
        <div className="flex flex-col items-start gap-6 rounded-2xl bg-panel p-8 text-white sm:p-12 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl">{home.closingTitle}</h2>
            <p className="mt-2 text-mist">{home.closingBody}</p>
          </div>
          <Link href={home.primaryCta.href} className={buttonVariants({ size: "lg" })}>
            {home.primaryCta.label}
            <ArrowRight aria-hidden />
          </Link>
        </div>
        <p className="mt-6 text-sm text-muted">{site.disclaimer}</p>
      </section>
    </>
  );
}
