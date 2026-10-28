import { after } from "next/server";
import { z } from "zod";
import { isTeaserScanEnabled } from "@/lib/flags";
import { apiSession, json, jsonError } from "@/lib/http";
import { dispatchRun } from "@/lib/runs/dispatch";
import { failQueuedRun } from "@/lib/db/repos/runs";
import { confirmTeaser } from "@/lib/teasers/service";

export const maxDuration = 60;

const Body = z.object({ intake: z.record(z.string(), z.unknown()), resolutions: z.record(z.string(), z.string()).default({}) });

/** POST /api/teasers/{id}/confirm: confirmed answers and resolved conflicts → Quick Report + run (S-18). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTeaserScanEnabled()) return jsonError(404, "NOT_FOUND", "Not found");
  const a = await apiSession({ mutating: true });
  if ("error" in a) return a.error;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError(400, "VALIDATION", "intake and resolutions are required");
  const r = await confirmTeaser(a.session.user, (await params).id, body.data);
  if (!r.ok) return json({ error: { code: r.code, message: r.message, issues: r.issues, conflicts: r.conflicts } }, { status: r.status });
  if (r.runId) {
    try {
      await dispatchRun(r.runId, { schedule: (task) => after(task), origin: new URL(req.url).origin });
    } catch (err) {
      console.error("dispatch failed:", err instanceof Error ? err.message : err);
      await failQueuedRun(r.runId, "VS_UNAVAILABLE").catch(() => null);
    }
  }
  return json({ reportId: r.reportId, runId: r.runId, runError: r.runError ?? null }, { status: 201 });
}
