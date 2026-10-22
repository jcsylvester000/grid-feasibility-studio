import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAjv } from "@/lib/contract/registry";
import { validateEnvelope, validatePayload } from "@/lib/contract/validate";
import { buildEnvelope } from "@/lib/contract/envelope";
import type { Product } from "@/lib/db/schema";

const products: Product[] = ["quick_report", "executive_summary", "feasibility_report", "teaser_intake"];
const golden = (p: Product) =>
  JSON.parse(readFileSync(path.join("mock/vectorshift/payloads", `${p}.json`), "utf8")) as Record<string, unknown>;

describe("schema files", () => {
  it("are byte-identical to the blueprint copy recorded in schemas.sha256 (BRD 8.2)", () => {
    const manifest = readFileSync("lib/contract/schemas.sha256", "utf8").trim().split("\n");
    const files = readdirSync("lib/contract/schemas").filter((f) => f.endsWith(".json")).sort();
    expect(manifest).toHaveLength(files.length);
    for (const line of manifest) {
      const [hash, name] = line.split(/\s+/);
      const actual = createHash("sha256").update(readFileSync(path.join("lib/contract/schemas", name!))).digest("hex");
      expect(actual, name).toBe(hash);
    }
  });

  it("all compile in Ajv (JSON Schema 2020-12)", () => {
    expect(() => getAjv()).not.toThrow();
  });
});

describe("golden payloads", () => {
  for (const p of products) {
    it(`${p} validates against its product schema`, () => {
      const r = validatePayload(p, golden(p));
      expect(r.ok ? [] : r.issues).toEqual([]);
    });
    it(`${p} wrapped in a succeeded envelope passes validateEnvelope`, () => {
      const env = buildEnvelope({ product: p, reportId: "rep_1", runId: "run_1", status: "succeeded", payload: golden(p) });
      const r = validateEnvelope(env, { product: p, reportId: "rep_1" });
      expect(r.ok ? [] : r.issues).toEqual([]);
    });
  }
});

describe("rejections", () => {
  const ok = () =>
    buildEnvelope({ product: "quick_report", reportId: "rep_1", runId: "run_1", status: "succeeded", payload: golden("quick_report") });

  it("rejects an extra top-level field", () => {
    expect(validateEnvelope({ ...ok(), extra: 1 }, { product: "quick_report", reportId: "rep_1" }).ok).toBe(false);
  });
  it("rejects a missing field", () => {
    const e = ok() as Record<string, unknown>;
    delete e.warnings;
    expect(validateEnvelope(e, { product: "quick_report", reportId: "rep_1" }).ok).toBe(false);
  });
  it("rejects an extra field inside the payload", () => {
    const e = ok();
    (e.report as Record<string, unknown>).surprise = true;
    expect(validateEnvelope(e, { product: "quick_report", reportId: "rep_1" }).ok).toBe(false);
  });
  it("rejects a product mismatch with the request", () => {
    expect(validateEnvelope(ok(), { product: "executive_summary", reportId: "rep_1" }).ok).toBe(false);
  });
  it("rejects a payload that belongs to another product", () => {
    const e = buildEnvelope({ product: "quick_report", reportId: "rep_1", runId: "r", status: "succeeded", payload: golden("executive_summary") });
    expect(validateEnvelope(e, { product: "quick_report", reportId: "rep_1" }).ok).toBe(false);
  });
  it("rejects a report_id that does not echo the request (VS-06)", () => {
    expect(validateEnvelope(ok(), { product: "quick_report", reportId: "other" }).ok).toBe(false);
  });
  it("rejects a failed envelope with no errors", () => {
    const e = buildEnvelope({ product: "quick_report", reportId: "rep_1", runId: "r", status: "failed", errors: [] });
    expect(validateEnvelope(e, { product: "quick_report", reportId: "rep_1" }).ok).toBe(false);
  });
  it("accepts a failed envelope with an error code", () => {
    const e = buildEnvelope({
      product: "quick_report", reportId: "rep_1", runId: "r", status: "failed",
      errors: [{ code: "INPUT_INSUFFICIENT", message: "Not enough inputs." }],
    });
    expect(validateEnvelope(e, { product: "quick_report", reportId: "rep_1" }).ok).toBe(true);
  });
  it("rejects a report sent while the run is still running", () => {
    const e = { ...ok(), run: { ...ok().run, status: "running" } };
    expect(validateEnvelope(e, { product: "quick_report", reportId: "rep_1" }).ok).toBe(false);
  });
});
