/* eslint-disable @typescript-eslint/no-explicit-any */
/** Demo scenarios (prototype): 20 ready reports, contract-valid, idempotent; the mock follows the inputs. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../helpers/pglite";
import { registerAccount } from "@/lib/auth/service";
import { seedDemoScenarios } from "@/lib/demo/seed";
import { SCENARIOS } from "@/lib/demo/scenarios";
import { prototypePayload } from "@/lib/demo/engine";
import { latestEnvelopeForReport } from "@/lib/db/repos/runs";
import { reports } from "@/lib/db/schema";
import { validatePayload } from "@/lib/contract/validate";
import { validateIntake } from "@/lib/forms";
import { handleMockRequest } from "@/mock/vectorshift/handler";

process.env.APP_SECRET = "test-secret-test-secret-test-secret-123";
let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.close());

describe("demo scenarios", () => {
  it("20 scenarios: 8 Quick Reports, 6 Executive Summaries, 6 Feasibility Reports, with a spread of outcomes", () => {
    expect(SCENARIOS).toHaveLength(20);
    const count = (p: string) => SCENARIOS.filter((s) => s.product === p).length;
    expect([count("quick_report"), count("executive_summary"), count("feasibility_report")]).toEqual([8, 6, 6]);
    const ratings = SCENARIOS.map((s) => {
      const p = prototypePayload(s.product, s.intake) as any;
      expect(validatePayload(s.product, p).ok).toBe(true);
      expect(p.meta.disclaimer).toMatch(/^PROTOTYPE/);
      return s.product === "quick_report" ? p.indicative.rating : (p.verdict ?? p.front_matter.executive_summary.verdict).rating;
    });
    for (const r of ["promising", "marginal", "weak", "cannot_tell", "feasible", "conditionally_feasible", "not_feasible", "insufficient_data"]) expect(ratings).toContain(r);
  });

  it("every scenario except the deliberate 'no comparables' one passes the form's own validation", () => {
    const failing = SCENARIOS.filter((s) => !validateIntake(s.product, s.intake)?.ok).map((s) => s.code);
    expect(failing).toEqual(["D06"]);
  });

  it("seeding gives 20 ready reports with stored, valid envelopes; seeding again adds nothing", async () => {
    const r = await registerAccount({ username: `demo_${Date.now() % 1e5}`, password: "mango lamp river seven", confirmPassword: "mango lamp river seven", acceptTerms: true, address: "10.3.0.1" });
    if (!r.ok) throw new Error("register");
    expect(await seedDemoScenarios(r.user)).toEqual({ created: 20, total: 20 });
    expect(await seedDemoScenarios(r.user)).toEqual({ created: 0, total: 20 });
    const rows = await t.db.select().from(reports).where(eq(reports.userId, r.user.id));
    expect(rows).toHaveLength(20);
    expect(rows.every((x) => x.status === "ready")).toBe(true);
    const env = await latestEnvelopeForReport(rows[0]!.id);
    expect(env!.run.pipelineId).toBe("demo-prototype");
    expect((env!.envelope.envelope as any).report.meta.report_id).toBe(rows[0]!.id);
  });

  it("the mock pipeline builds the report from the run's inputs when MOCK_VS_PAYLOADS=prototype", async () => {
    process.env.MOCK_VS_PAYLOADS = "prototype";
    try {
      const s = SCENARIOS.find((x) => x.code === "D03")!;
      const runRequest = { product: "quick_report", report_id: "00000000-0000-4000-8000-000000000003", intake: s.intake, documents: [] };
      const res = await handleMockRequest(
        new Request("http://localhost:4010/v1/pipeline/mock-quick_report/run", {
          method: "POST",
          headers: { authorization: "Bearer x", "content-type": "application/json" },
          body: JSON.stringify({ inputs: { run_request: JSON.stringify(runRequest) } }),
        }),
        { delayMs: 0 },
      );
      const body = (await res.json()) as { outputs: { result_envelope: string } };
      const env = JSON.parse(body.outputs.result_envelope);
      expect(env.report.indicative.rating).toBe("weak");
    } finally {
      delete process.env.MOCK_VS_PAYLOADS;
    }
  });
});
