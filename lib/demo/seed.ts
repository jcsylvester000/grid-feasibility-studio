/**
 * Loads the 20 demo scenarios into one account (prototype demos and training). Each becomes a ready report
 * built by the stand-in pipeline (lib/demo/engine.ts) and validated against the contract like any real
 * result. Idempotent: scenarios already in the account (same title) are skipped.
 * Available when DEMO_MODE=true, or always in development.
 */
import { buildEnvelope } from "@/lib/contract/envelope";
import { validateEnvelope } from "@/lib/contract/validate";
import { createDraftReport } from "@/lib/db/repos/reports";
import { insertFinishedRun } from "@/lib/db/repos/runs";
import { listReportTitles } from "@/lib/db/repos/reports";
import type { UserRow } from "@/lib/db/repos/users";
import { track } from "@/lib/usage/track";
import { prototypePayload } from "./engine";
import { SCENARIOS } from "./scenarios";

export const DEMO_PIPELINE_ID = "demo-prototype";

export function demoEnabled() {
  return process.env.DEMO_MODE === "true" || process.env.NODE_ENV === "development";
}

/** Typical times for the stand-in runs (shown in the run history; illustrative). */
const DURATION_MS = { quick_report: 95_000, executive_summary: 540_000, feasibility_report: 1_380_000 } as const;

export async function seedDemoScenarios(user: Pick<UserRow, "id" | "publicId">, now = new Date()) {
  const existing = new Set(await listReportTitles(user.id));
  let created = 0;
  for (const [i, s] of SCENARIOS.entries()) {
    if (existing.has(s.title)) continue;
    const report = await createDraftReport(user.id, s.product, s.title, s.intake);
    // Spread the "finished" times over the last 20 days so the lists look like real use.
    const at = new Date(now.getTime() - (SCENARIOS.length - i) * 86400_000 + i * 60_000);
    const payload = prototypePayload(s.product, s.intake, { reportId: report.id, sample: true, now: at });
    const runId = `demo_${s.code.toLowerCase()}_${report.id.slice(0, 8)}`;
    const envelope = buildEnvelope({ product: s.product, reportId: report.id, runId, status: "succeeded", payload, dagVersion: "prototype-0.2.0", submittedAt: new Date(at.getTime() - DURATION_MS[s.product]) });
    const checked = validateEnvelope(envelope, { product: s.product, reportId: report.id });
    if (!checked.ok) throw new Error(`Demo scenario ${s.code} does not match the contract: ${JSON.stringify(checked.issues.slice(0, 3))}`);
    await insertFinishedRun({
      reportId: report.id,
      product: s.product,
      pipelineId: DEMO_PIPELINE_ID,
      vsRunId: runId,
      durationMs: DURATION_MS[s.product],
      envelope: { schemaVersion: envelope.schema_version, envelope: envelope as unknown as Record<string, unknown> },
      at,
      inputSnapshot: { intake: s.intake, mode: "run_request", sent: null, report_ref: null, recorded_at: at.toISOString() },
    });
    await track(user.publicId, "report.created", { product: s.product });
    created++;
  }
  return { created, total: SCENARIOS.length };
}
