import { createRouteHandler } from "uploadthing/next";
import { uploadRouter } from "@/lib/files/uploadthing-router";

/** UploadThing route (presigned uploads and the upload-complete callback). Token from UPLOADTHING_TOKEN. */
export const { GET, POST } = createRouteHandler({ router: uploadRouter, config: { token: process.env.UPLOADTHING_TOKEN } });
