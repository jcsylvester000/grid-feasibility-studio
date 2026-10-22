import "server-only";
/**
 * UploadThing file router (BRD section 9). Browsers upload straight to UploadThing with presigned URLs
 * (UP-01); this router only authorizes (UP-02) and records the result (UP-03). Files are private (UP-04).
 * UploadThing sizes must be powers of two, so the route allows 32 MB and the middleware enforces 25 MB.
 * teaserMedia (Teaser Scan): images and PDF up to 25 MB, MP4 or MOV up to 200 MB (route allows 256 MB).
 */
import { z } from "zod";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { getCurrentSession } from "@/lib/auth/session";
import { DOC_TYPES } from "./config";
import { authorizeUpload, recordUpload } from "./service";

const f = createUploadthing();
const doc = { maxFileSize: "32MB", maxFileCount: 10, acl: "private" } as const;
const video = { maxFileSize: "256MB", maxFileCount: 10, acl: "private" } as const;
const input = z.object({ reportId: z.string().uuid(), docType: z.enum(DOC_TYPES.map((d) => d.value) as [string, ...string[]]).nullable() });

function guard(route: "documents" | "teaserMedia") {
  return async ({ files, input: i }: { files: readonly { name: string; size: number; type: string }[]; input: z.infer<typeof input> }) => {
    const s = await getCurrentSession();
    if (!s) throw new UploadThingError({ code: "FORBIDDEN", message: "Sign in first" });
    const ok = await authorizeUpload(s.user, i.reportId, files.map((x) => ({ name: x.name, size: x.size, type: x.type })), route);
    if (!ok.ok) throw new UploadThingError({ code: ok.status === 404 ? "NOT_FOUND" : "BAD_REQUEST", message: ok.message });
    return { userPublicId: s.user.publicId, reportId: i.reportId, docType: i.docType };
  };
}

async function complete({ metadata, file }: { metadata: { userPublicId: string; reportId: string; docType: string | null }; file: { key: string; name: string; type: string; size: number } }) {
  const row = await recordUpload(metadata.userPublicId, metadata.reportId, { key: file.key, name: file.name, type: file.type, size: file.size }, metadata.docType);
  return { fileId: row?.id ?? null };
}

export const uploadRouter = {
  documents: f({ "application/pdf": doc, "image/jpeg": doc, "image/png": doc, "image/heic": doc })
    .input(input)
    .middleware(guard("documents"))
    .onUploadComplete(complete),
  teaserMedia: f({ "application/pdf": doc, "image/jpeg": doc, "image/png": doc, "image/heic": doc, "image/webp": doc, "video/mp4": video, "video/quicktime": video })
    .input(input)
    .middleware(guard("teaserMedia"))
    .onUploadComplete(complete),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
