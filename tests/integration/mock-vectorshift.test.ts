import { describe, expect, it } from "vitest";
import { handleMockRequest, mockLog } from "@/mock/vectorshift/handler";
import { validateEnvelope } from "@/lib/contract/validate";

const call = (pipeline: string, body: BodyInit, headers: Record<string, string> = {}) =>
  handleMockRequest(
    new Request(`http://mock/v1/pipeline/${pipeline}/run`, {
      method: "POST",
      headers: { authorization: "Bearer test", ...headers },
      body,
    }),
    { delayMs: 0 },
  );
const rr = (product: string) => JSON.stringify({ inputs: { run_request: JSON.stringify({ product, report_id: "rep_9" }) } });

describe("mock VectorShift", () => {
  it("returns a valid envelope for every product", async () => {
    for (const p of ["quick_report", "executive_summary", "feasibility_report", "teaser_intake"] as const) {
      const res = await call(`mock-${p}`, rr(p), { "content-type": "application/json" });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; outputs: { result_envelope: string } };
      expect(body.status).toBe("success");
      const v = validateEnvelope(JSON.parse(body.outputs.result_envelope), { product: p, reportId: "rep_9" });
      expect(v.ok ? [] : v.issues).toEqual([]);
    }
  });

  it("accepts multipart with files", async () => {
    const form = new FormData();
    form.set("inputs", JSON.stringify({ run_request: JSON.stringify({ product: "executive_summary", report_id: "rep_9" }) }));
    form.set("inputs.file_1", new Blob(["%PDF-1.4"], { type: "application/pdf" }), "title.pdf");
    const res = await call("mock-executive_summary", form);
    expect(res.status).toBe(200);
    expect(mockLog.at(-1)?.files[0]).toMatch(/^inputs.file_1:title.pdf:/);
  });

  it("simulates failures", async () => {
    expect((await call("mock-quick_report--auth", rr("quick_report"))).status).toBe(401);
    expect((await call("mock-quick_report--bad_request", rr("quick_report"))).status).toBe(400);
    expect((await call("mock-quick_report--server_error", rr("quick_report"))).status).toBe(500);
    expect((await call("mock-quick_report--unavailable", rr("quick_report"))).status).toBe(503);
    const failed = (await (await call("mock-quick_report--failed", rr("quick_report"))).json()) as { status: string };
    expect(failed.status).toBe("failed");
    const missing = (await (await call("mock-quick_report--missing_output", rr("quick_report"))).json()) as { outputs: object };
    expect(missing.outputs).not.toHaveProperty("result_envelope");
  });

  it("rejects calls without a bearer key", async () => {
    const res = await handleMockRequest(new Request("http://mock/v1/pipeline/mock-quick_report/run", { method: "POST", body: rr("quick_report") }));
    expect(res.status).toBe(401);
  });
});
