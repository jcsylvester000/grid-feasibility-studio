/**
 * Netlify Scheduled Function: deletes files past delete_after (90 days after the last run that used
 * them) and retries queued UploadThing deletions (UP-06). Daily at 02:30 Asia/Manila (18:30 UTC).
 */
import type { Config } from "@netlify/functions";
import { runFileCleanup } from "../../lib/files/service";

export default async () => {
  const result = await runFileCleanup();
  console.log(JSON.stringify({ job: "file-cleanup", ...result }));
};

export const config: Config = { schedule: "30 18 * * *" };
