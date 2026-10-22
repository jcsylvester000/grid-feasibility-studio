import { readFile } from "node:fs/promises";
import path from "node:path";
import { localDir, uploadDriver, verifyLocalSignature } from "@/lib/files/storage";

/** Serves a local-driver file for a valid, unexpired signed URL (mirrors UploadThing signed URLs). */
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  if (uploadDriver() !== "local") return new Response("Not found", { status: 404 });
  const { key } = await params;
  const u = new URL(req.url);
  if (!/^[A-Za-z0-9._-]{8,200}$/.test(key) || !verifyLocalSignature(key, Number(u.searchParams.get("e")), u.searchParams.get("s") ?? ""))
    return new Response("Link expired", { status: 403 });
  try {
    const bytes = await readFile(path.join(/*turbopackIgnore: true*/ localDir(), key));
    return new Response(bytes, { headers: { "content-type": "application/octet-stream", "cache-control": "private, no-store" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
