/**
 * Teaser Scan confirm (BRD v2.0 section 13: POST /api/teasers/{id}/confirm). Nothing is created until the
 * broker confirms (TS-AC-08). Confirm checks every conflict is resolved and the Quick Report answers are
 * complete, creates the Quick Report with listing_source and starts its run.
 */
import { getDb } from "@/lib/db/client";
import { createDraftReport, getReportForUser } from "@/lib/db/repos/reports";
import { latestEnvelopeForReport } from "@/lib/db/repos/runs";
import type { UserRow } from "@/lib/db/repos/users";
import { reports } from "@/lib/db/schema";
import { validateIntake } from "@/lib/forms";
import type { Issue } from "@/lib/forms/types";
import { startRun } from "@/lib/runs/service";
import { track } from "@/lib/usage/track";
import { eq } from "drizzle-orm";
import { conflictGroups, listingSource, unresolved } from "./review";

export type ConfirmResult =
  | { ok: true; reportId: string; runId: string | null; runError?: string }
  | { ok: false; status: number; code: string; message: string; issues?: Issue[]; conflicts?: string[] };

/** The teaser report, its stored payload and whether it can still be confirmed. */
export async function loadTeaser(user: UserRow, id: string) {
  const report = await getReportForUser(user.id, id);
  if (!report || report.product !== "teaser_intake") return null;
  const stored = await latestEnvelopeForReport(report.id);
  const payload = (stored?.envelope.envelope as { report?: Record<string, unknown> } | undefined)?.report ?? null;
  return { report, payload };
}

export async function confirmTeaser(user: UserRow, id: string, body: { intake: Record<string, unknown>; resolutions: Record<string, string> }): Promise<ConfirmResult> {
  const t = await loadTeaser(user, id);
  if (!t) return { ok: false, status: 404, code: "NOT_FOUND", message: "Scan not found" };
  if (t.report.status !== "needs_confirmation" || !t.payload)
    return { ok: false, status: 409, code: "NOT_CONFIRMABLE", message: "This scan has already been confirmed or is not ready." };

  const open = unresolved(t.payload, body.resolutions ?? {});
  if (open.length) return { ok: false, status: 400, code: "CONFLICTS_OPEN", message: "Choose which value is right for every conflict.", conflicts: open.map((g) => g.key) };

  const checked = validateIntake("quick_report", body.intake ?? {});
  if (!checked?.ok) return { ok: false, status: 400, code: "INPUT_INVALID", message: "Some required answers are missing.", issues: checked?.issues };

  const groups = conflictGroups(t.payload);
  const intake = {
    ...checked.intake,
    listing_source: listingSource(t.payload, checked.intake),
    "teaser.source_report_id": t.report.id,
    "teaser.resolutions": Object.fromEntries(groups.map((g) => [g.key, body.resolutions[g.key]!])),
  };
  const city = typeof checked.intake["property.city"] === "string" ? checked.intake["property.city"] : null;
  const qr = await createDraftReport(user.id, "quick_report", `Quick Report · ${city ?? "from teaser"} (from teaser)`, intake);
  await track(user.publicId, "report.created", { product: "quick_report" });

  const db = await getDb();
  await db
    .update(reports)
    .set({ status: "ready", intake: { ...t.report.intake, "teaser.confirmed_report_id": qr.id }, updatedAt: new Date() })
    .where(eq(reports.id, t.report.id));

  const run = await startRun(user, qr.id);
  return run.ok ? { ok: true, reportId: qr.id, runId: run.runId } : { ok: true, reportId: qr.id, runId: null, runError: run.message };
}
