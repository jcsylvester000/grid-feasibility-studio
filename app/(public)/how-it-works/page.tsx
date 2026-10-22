import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { howItWorks as hw } from "@/content/site";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "How it works",
  description: "Four steps from a question to a sourced property feasibility report.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <>
      <section className="bg-navy text-white">
        <div className="container-page py-14 sm:py-16">
          <p className="eyebrow !text-gold">How it works</p>
          <h1 className="mt-3 text-4xl sm:text-5xl">{hw.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-mist">{hw.intro}</p>
        </div>
      </section>

      <section aria-label="Steps" className="container-page py-14">
        <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {hw.steps.map((s, i) => (
            <li key={s.title} className="rounded-[var(--radius-card)] border border-line bg-white p-6">
              <span className="flex size-10 items-center justify-center rounded-full bg-navy font-display text-lg text-gold">
                {i + 1}
              </span>
              <h2 className="mt-4 text-xl">{s.title}</h2>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="faq" className="container-page pb-16">
        <h2 id="faq" className="text-3xl">Questions</h2>
        {/* Native details/summary: works with JavaScript disabled (AC-006). */}
        <div className="mt-6 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
          {hw.faq.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
        <Link href="/register" className={buttonVariants({ size: "lg", className: "mt-8" })}>
          Start free
        </Link>
      </section>
    </>
  );
}
