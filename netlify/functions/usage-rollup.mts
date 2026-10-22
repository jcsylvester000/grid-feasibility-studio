/**
 * Netlify Scheduled Function: nightly usage rollup at 02:00 Asia/Manila (18:00 UTC), BRD 11.4.
 * Rebuilds usage_daily for yesterday and today and deletes usage events older than 24 months (PV-05).
 */
import type { Config } from "@netlify/functions";
import { manilaDate, purgeOldEvents, rollupDay } from "../../lib/db/repos/admin";

export default async () => {
  const now = new Date();
  const days = [manilaDate(new Date(now.getTime() - 86400_000)), manilaDate(now)];
  for (const d of days) await rollupDay(d);
  await purgeOldEvents(now);
  console.log(JSON.stringify({ job: "usage-rollup", days }));
};

export const config: Config = { schedule: "0 18 * * *" };
