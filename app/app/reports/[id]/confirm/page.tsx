/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TeaserCheck } from "@/components/report/views";
import { ConfirmForm } from "@/components/teasers/confirm-form";
import { CopyButton } from "@/components/teasers/copy-button";
import { requireUser } from "@/lib/auth/session";
import { listFilesForReport } from "@/lib/db/repos/files";
import { isTeaserScanEnabled } from "@/lib/flags";
import { getOptions } from "@/lib/options";
import { conflictGroups, fieldSources, prefill } from "@/lib/teasers/review";
import { loadTeaser } from "@/lib/teasers/service";

export const metadata: Metadata = { title: "Check and confirm" };

/** S-18 Check and confirm. Only the owner, only while the scan waits for confirmation. */
export default async function ConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isTeaserScanEnabled()) notFound();
  const { id } = await params;
  const { user } = await requireUser(`/app/reports/${id}/confirm`);
  const t = await loadTeaser(user, id);
  if (!t) notFound();
  if (t.report.status !== "needs_confirmation" || !t.payload) redirect(`/app/reports/${id}`);
  const p = t.payload as any;
  const opts = getOptions("quick_report");
  const files = await listFilesForReport(t.report.id);
  const questions: string[] = p.questions_for_seller ?? [];
  const pasted = typeof t.report.intake["teaser.pasted_text"] === "string" ? (t.report.intake["teaser.pasted_text"] as string) : null;

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Teaser Scan · check and confirm</p>
        <h1 className="mt-2 text-3xl">{p.listing?.headline_as_written ?? t.report.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Contact details found in the files were hidden. Claims are checked against public sources where possible; nothing is shared until you confirm.
        </p>
      </header>
      <ConfirmForm
        teaserId={t.report.id}
        fields={opts.fields}
        locations={opts.locations}
        prefill={prefill(p)}
        sources={fieldSources(p)}
        conflicts={conflictGroups(p)}
        files={files.map((f) => f.name)}
        pastedText={pasted}
        aside={
          <div className="space-y-4">
            <TeaserCheck ls={{ files_count: (p.files ?? []).length, relationship: p.meta?.relationship, claims: p.claims, red_flags: p.red_flags, questions_for_seller: [] }} />
            {questions.length > 0 && (
              <section aria-labelledby="seller-q" className="space-y-2" data-testid="seller-questions">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="seller-q" className="font-sans text-sm font-semibold">Questions for the seller</h2>
                  <CopyButton text={questions.map((q, i) => `${i + 1}. ${q}`).join("\n")} />
                </div>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        }
      />
      <Link href="/app/reports" className="text-sm">Back to my reports</Link>
    </div>
  );
}
