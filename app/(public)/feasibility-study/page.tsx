import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Info, Landmark, LineChart, ShieldAlert, Store } from "lucide-react";
import { feasibilityStudy as fs, site } from "@/content/site";
import { buttonVariants } from "@/components/ui/button";
import { isTeaserScanEnabled } from "@/lib/flags";

export const metadata: Metadata = {
  title: "What is a feasibility study",
  description: fs.intro,
  alternates: { canonical: "/feasibility-study" },
};

const icons = { market: Store, site: Building2, legal: Landmark, financial: LineChart, risks: ShieldAlert } as const;

export default function FeasibilityStudyPage() {
  return (
    <>
      <section className="bg-navy text-white">
        <div className="container-page py-14 sm:py-16">
          <p className="eyebrow !text-gold">Guide</p>
          <h1 className="mt-3 text-4xl sm:text-5xl">{fs.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-mist">{fs.intro}</p>
        </div>
      </section>

      <section aria-label="The five parts" className="container-page py-14">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {fs.blocks.map((b) => {
            const Icon = icons[b.icon as keyof typeof icons];
            return (
              <li key={b.title} className="rounded-[var(--radius-card)] border border-line bg-white p-6">
                <Icon aria-hidden className="size-6 text-bronze" />
                <h2 className="mt-3 text-2xl">{b.title}</h2>
                <p className="mt-2 text-muted">{b.body}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="which" className="container-page pb-16">
        <h2 id="which" className="text-3xl">{fs.whichTitle}</h2>
        {/* AC-005: the disclaimer sits above the table, so it is seen before scrolling past it. */}
        <p role="note" className="mt-4 flex gap-2 rounded-lg bg-bronze-soft p-4 text-sm text-ink">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-bronze-ink" />
          <span>{site.disclaimer}</span>
        </p>
        <div tabIndex={0} className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-sand text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">If you need…</th>
                <th scope="col" className="px-4 py-3 font-medium">Use</th>
                <th scope="col" className="px-4 py-3 font-medium">What you get</th>
              </tr>
            </thead>
            <tbody>
              {fs.which.filter((r) => !("flag" in r) || isTeaserScanEnabled()).map((r) => (
                <tr key={r.product} className="border-t border-line">
                  <td className="px-4 py-3">{r.need}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link href="/how-it-works">{r.product}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{r.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link href="/register" className={buttonVariants({ size: "lg", className: "mt-8" })}>
          Create account
        </Link>
      </section>
    </>
  );
}
