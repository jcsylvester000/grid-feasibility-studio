/**
 * Files (BRD section 9): upload rules (UP-02), recording (UP-03), signed reads for runs (UP-04, VS-03),
 * deletion of a file, a report or an account and the daily cleanup (UP-06, AC-033, AC-034).
 * Storage is a recording stand-in for UploadThing.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../helpers/pglite";
import { registerAccount } from "@/lib/auth/service";
import { deleteAccount } from "@/lib/auth/account";
import { createReport, removeReport } from "@/lib/reports/service";
import { files, pendingFileDeletions, reports, usageEvents } from "@/lib/db/schema";
import { authorizeUpload, recordUpload, removeFile, runFileCleanup } from "@/lib/files/service";
import { setStorageOverride, type Storage } from "@/lib/files/storage";
import { docsIntake, loadRunFiles } from "@/lib/files/run-files";
import { buildRunRequest } from "@/lib/runs/run-request";
import { validateRunRequest } from "@/lib/contract/validate";

process.env.APP_SECRET = "test-secret-test-secret-test-secret-123";
const PW = "mango lamp river seven";
const MB = 1024 * 1024;
let t: Awaited<ReturnType<typeof createTestDb>>;
let n = 0;

const deleted: string[] = [];
let failDeletes = false;
const store = new Map<string, Uint8Array>();
const testStorage: Storage = {
  driver: "test",
  async signedUrl(key, seconds = 300) {
    return { url: `https://files.example.test/${key}?sig=1`, expiresAt: new Date(Date.now() + seconds * 1000) };
  },
  async read(key) {
    const b = store.get(key);
    if (!b) throw new Error("missing");
    return b;
  },
  async deleteKeys(keys) {
    if (failDeletes) throw new Error("UploadThing down");
    deleted.push(...keys);
    keys.forEach((k) => store.delete(k));
  },
};

beforeAll(async () => {
  t = await createTestDb();
  setStorageOverride(testStorage);
});
afterAll(async () => {
  setStorageOverride(null);
  await t.close();
});
beforeEach(() => {
  deleted.length = 0;
  failDeletes = false;
});

async function newUser() {
  n++;
  const r = await registerAccount({ username: `files_${n}_${Date.now() % 1e5}`, password: PW, confirmPassword: PW, acceptTerms: true, address: `10.8.0.${n}` });
  if (!r.ok) throw new Error("register failed");
  return r.user;
}

async function upload(user: Awaited<ReturnType<typeof newUser>>, reportId: string, name: string, docType: string | null = null) {
  const key = `ut_${n}_${Math.random().toString(36).slice(2)}`;
  const bytes = new TextEncoder().encode(`%PDF-1.4 ${name}`);
  store.set(key, bytes);
  const row = await recordUpload(user.publicId, reportId, { key, name, type: "application/pdf", size: bytes.byteLength }, docType);
  return row!;
}

describe("upload rules (UP-02)", () => {
  it("AC-025: a 30 MB file is refused with the plain message; nothing is stored", async () => {
    const u = await newUser();
    const r = await createReport(u, "executive_summary");
    const res = await authorizeUpload(u, r.id, [{ name: "big.pdf", size: 30 * MB, type: "application/pdf" }]);
    expect(res).toMatchObject({ ok: false, message: "Files must be 25 MB or smaller" });
    expect(await t.db.select().from(files).where(eq(files.reportId, r.id))).toHaveLength(0);
  });

  it("refuses other users' reports, the Quick Report, wrong types, running reports and an 11th file", async () => {
    const u = await newUser();
    const other = await newUser();
    const es = await createReport(u, "executive_summary");
    const qr = await createReport(u, "quick_report");
    const pdf = { name: "a.pdf", size: 1000, type: "application/pdf" };
    expect(await authorizeUpload(other, es.id, [pdf])).toMatchObject({ ok: false, status: 404 });
    expect(await authorizeUpload(u, qr.id, [pdf])).toMatchObject({ ok: false, status: 400 });
    expect(await authorizeUpload(u, es.id, [{ name: "a.webp", size: 10, type: "image/webp" }])).toMatchObject({ ok: false, message: "Use a PDF, JPG, PNG or HEIC file" });
    expect(await authorizeUpload(u, es.id, [{ name: "IMG_1.HEIC", size: 10, type: "" }])).toMatchObject({ ok: true });
    for (let i = 0; i < 9; i++) await upload(u, es.id, `f${i}.pdf`);
    expect(await authorizeUpload(u, es.id, [pdf])).toMatchObject({ ok: true });
    expect(await authorizeUpload(u, es.id, [pdf, pdf])).toMatchObject({ ok: false, message: "Up to 10 files per report" });
    await t.db.update(reports).set({ status: "running" }).where(eq(reports.id, es.id));
    expect(await authorizeUpload(u, es.id, [pdf])).toMatchObject({ ok: false, status: 409 });
  });

  it("UP-03: an upload writes the files row (delete_after 90 days) and a file.uploaded event with bytes", async () => {
    const u = await newUser();
    const r = await createReport(u, "feasibility_report");
    const f = await upload(u, r.id, "title.pdf", "title_documents");
    expect(f.docType).toBe("title_documents");
    const days = (f.deleteAfter.getTime() - Date.now()) / 86400_000;
    expect(days).toBeGreaterThan(89.9);
    const ev = await t.db.select().from(usageEvents).where(eq(usageEvents.userPublicId, u.publicId));
    expect(ev.find((e) => e.event === "file.uploaded")?.bytes).toBe(f.sizeBytes);
    expect(JSON.stringify(ev)).not.toContain("title.pdf");
  });
});

describe("runs read files through signed URLs (UP-04, VS-03)", () => {
  it("a report started from another report also reads that report's documents, once each", async () => {
    const u = await newUser();
    const es = await createReport(u, "executive_summary");
    const fr = await createReport(u, "feasibility_report");
    await upload(u, es.id, "title.pdf", "title_documents");
    await upload(u, fr.id, "zoning.pdf", "zoning_certificate");
    await upload(u, fr.id, "title.pdf", "title_documents"); // same file uploaded again: counted once
    const { documents } = await loadRunFiles("run", fr.id, [es.id]);
    expect(documents.map((d) => d.file_name)).toEqual(["zoning.pdf", "title.pdf"]);
  });

  it("lists documents in upload order with doc refs and capabilities, and keeps files 90 days from the run", async () => {
    const u = await newUser();
    const r = await createReport(u, "feasibility_report");
    const a = await upload(u, r.id, "title.pdf", "title_documents");
    await upload(u, r.id, "photo.pdf", "other");
    await t.db.update(files).set({ deleteAfter: new Date(Date.now() + 86400_000) }).where(eq(files.id, a.id));
    const { documents, files: bytes } = await loadRunFiles("run", r.id);
    expect(documents.map((d) => [d.doc_ref, d.file_name, d.capability])).toEqual([
      ["doc-1", "title.pdf", "title_documents"],
      ["doc-2", "photo.pdf", undefined],
    ]);
    expect(bytes.map((b) => b.name)).toEqual(["title.pdf", "photo.pdf"]);
    expect(documents[0]!.url).toContain("sig=");
    expect(new Date(documents[0]!.expires_at).getTime() - Date.now()).toBeLessThanOrEqual(300_000);
    const [row] = await t.db.select().from(files).where(eq(files.id, a.id));
    expect(row!.deleteAfter.getTime() - Date.now()).toBeGreaterThan(89 * 86400_000);
    expect(docsIntake(documents)).toEqual({ "docs.title_documents": "doc-1" });

    const req = buildRunRequest({ product: "feasibility_report", reportId: r.id, attempt: 1, intake: { "property.city": "Taguig" }, complete: true, userPublicId: u.publicId, appOrigin: "http://localhost:3000", documents });
    expect(validateRunRequest(req).ok).toBe(true);
    expect(req.run_context.input_level).toBe("L0_location_only");
  });
});

describe("deletion (UP-06)", () => {
  it("AC-033: deleting a report with two files removes the rows and both stored files", async () => {
    const u = await newUser();
    const r = await createReport(u, "executive_summary");
    const a = await upload(u, r.id, "a.pdf");
    const b = await upload(u, r.id, "b.pdf");
    expect(await removeReport(u, r.id)).toBe(true);
    expect(deleted.sort()).toEqual([a.utKey, b.utKey].sort());
    expect(await t.db.select().from(files).where(eq(files.reportId, r.id))).toHaveLength(0);
    expect(await t.db.select().from(pendingFileDeletions).where(eq(pendingFileDeletions.utKey, a.utKey))).toHaveLength(0);
  });

  it("a failed storage call leaves the key queued; the daily cleanup retries it", async () => {
    const u = await newUser();
    const r = await createReport(u, "executive_summary");
    const a = await upload(u, r.id, "a.pdf");
    failDeletes = true;
    expect((await removeFile(u, a.id)).ok).toBe(true);
    const [q] = await t.db.select().from(pendingFileDeletions).where(eq(pendingFileDeletions.utKey, a.utKey));
    expect(q!.attempts).toBe(1);
    failDeletes = false;
    const res = await runFileCleanup();
    expect(res.failed).toBe(0);
    expect(deleted).toContain(a.utKey);
    expect(await t.db.select().from(pendingFileDeletions).where(eq(pendingFileDeletions.utKey, a.utKey))).toHaveLength(0);
  });

  it("the daily cleanup deletes files past delete_after", async () => {
    const u = await newUser();
    const r = await createReport(u, "executive_summary");
    const old = await upload(u, r.id, "old.pdf");
    const fresh = await upload(u, r.id, "fresh.pdf");
    await t.db.update(files).set({ deleteAfter: new Date(Date.now() - 1000) }).where(eq(files.id, old.id));
    const res = await runFileCleanup();
    expect(res.expired).toBeGreaterThanOrEqual(1);
    expect(deleted).toContain(old.utKey);
    expect(deleted).not.toContain(fresh.utKey);
    expect(await t.db.select().from(files).where(eq(files.id, fresh.id))).toHaveLength(1);
  });

  it("AC-034: deleting an account deletes its stored files", async () => {
    const u = await newUser();
    const r = await createReport(u, "feasibility_report");
    const a = await upload(u, r.id, "a.pdf");
    expect((await deleteAccount(u, u.displayUsername)).ok).toBe(true);
    expect(deleted).toContain(a.utKey);
    expect(await t.db.select().from(pendingFileDeletions).where(eq(pendingFileDeletions.utKey, a.utKey))).toHaveLength(0);
  });

  it("a user cannot delete another user's file", async () => {
    const u = await newUser();
    const other = await newUser();
    const r = await createReport(u, "executive_summary");
    const a = await upload(u, r.id, "a.pdf");
    expect((await removeFile(other, a.id)).ok).toBe(false);
    expect(await t.db.select().from(files).where(eq(files.id, a.id))).toHaveLength(1);
  });
});
