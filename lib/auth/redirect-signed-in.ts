import "server-only";
import { redirect } from "next/navigation";
import { getCurrentSession } from "./session";

/** Signed-in users who open /login or /register go to their home page. */
export async function redirectIfSignedIn() {
  const s = await getCurrentSession();
  if (s) redirect(s.user.role === "admin" ? "/admin" : "/app");
}
