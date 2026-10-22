import { demoEnabled, seedDemoScenarios } from "@/lib/demo/seed";
import { apiSession, json, jsonError } from "@/lib/http";

/** POST /api/demo/seed: loads the 20 demo scenarios into the signed-in account (DEMO_MODE or development). */
export async function POST() {
  if (!demoEnabled()) return jsonError(404, "NOT_FOUND", "Not found");
  const a = await apiSession({ mutating: true });
  if ("error" in a) return a.error;
  return json(await seedDemoScenarios(a.session.user), { status: 201 });
}
