import "server-only";
/**
 * UploadThing file router (BRD section 9). Browsers upload straight to UploadThing with presigned URLs
 * (UP-01); this router only authorizes (UP-02) and records the result (UP-03). Files are private (UP-04).
 * UploadThing sizes must be powers of two, so the route allows 32 MB and the middleware enforces 25 MB.
 * teaserMedia arrives with the Teaser Scan in batch B7.
 */
import { z } from "zod";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { getCurrentSession } from "@/lib/auth/session";
import { DOC_TYPES } from "./config";
import { authorizeUpload, recordUpload } from "./service";

const f = createUploadthing();
const doc = { maxFileSize: "32MB", maxFileCount: 10, acl: "private" } as const;

export const uploadRouter = {
  documents: f({ "application/pdf": doc, "image/jpeg": doc, "image/png": doc, "image/heic": doc })
    .input(z.object({ reportId: z.string().uuid(), docType: z.enum(DOC_TYPES.map((d) => d.value) as [string, ...string[]]).nullable() }))
    .middleware(async ({ files, input }) => {
      const s = await getCurrentSession();
      if (!s) throw new UploadThingError({ code: "FORBIDDEN", message: "Sign in first" });
      const ok = await authorizeUpload(s.user, input.reportId, files.map((x) => ({ name: x.name, size: x.size, type: x.type })));
      if (!ok.ok) throw new UploadThingError({ code: ok.status === 404 ? "NOT_FOUND" : "BAD_REQUEST", message: ok.message });
      return { userPublicId: s.user.publicId, reportId: input.reportId, docType: input.docType };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const row = await recordUpload(metadata.userPublicId, metadata.reportId, { key: file.key, name: file.name, type: file.type, size: file.size }, metadata.docType);
      return { fileId: row?.id ?? null };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
