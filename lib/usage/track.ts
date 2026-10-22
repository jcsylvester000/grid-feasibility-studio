/**
 * Usage events (BRD 11.1). Keyed by public User ID only. No network addresses, device fingerprints
 * or free text (PV-03). Tracking never breaks the user's action: failures are logged and swallowed.
 */
import { insertUsageEvent } from "@/lib/db/repos/usage";
import type { Product } from "@/lib/db/schema";

export type UsageEventName =
  | "user.registered"
  | "user.login"
  | "user.logout"
  | "user.login_failed"
  | "user.password_changed"
  | "user.recovery_key_regenerated"
  | "user.password_reset"
  | "user.deleted"
  | "report.created"
  | "report.deleted"
  | "report.viewed"
  | "report.printed"
  | "run.started"
  | "run.succeeded"
  | "run.failed"
  | "run.cancelled"
  | "file.uploaded"
  | "file.deleted"
  | "user.suspended"
  | "user.reactivated"
  | "user.reset_code_issued";

export async function track(
  userPublicId: string,
  event: UsageEventName,
  extra: {
    product?: Product;
    pipelineId?: string;
    durationMs?: number;
    bytes?: number;
    status?: string;
    errorCode?: string;
  } = {},
) {
  try {
    await insertUsageEvent({ userPublicId, event, ...extra });
  } catch (err) {
    console.error(`usage: could not record ${event}:`, err instanceof Error ? err.message : err);
  }
}
