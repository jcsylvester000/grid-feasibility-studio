import { NextResponse, type NextRequest } from "next/server";
import { isUsernameAvailable } from "@/lib/auth/service";
import { clientAddress } from "@/lib/auth/session";

/** GET /api/auth/username-available?u= : on-blur check on the Register form (rate limited per address). */
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const result = await isUsernameAvailable(u, await clientAddress());
  if (result.available === null) return NextResponse.json(result, { status: 429 });
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
