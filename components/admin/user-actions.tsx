"use client";
/** AD-03 actions: Suspend or Reactivate; Issue reset code (shown once). Each asks for confirmation. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function UserActions({ publicId, status, isSelf, isAdmin }: { publicId: string; status: string; isSelf: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function act(action: "suspend" | "reactivate" | "reset-code", question: string) {
    if (!window.confirm(question)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${publicId}/${action}`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body?.error?.message ?? "The action failed.");
    if (action === "reset-code") setCode({ code: body.code, expiresAt: body.expiresAt });
    else router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "active" ? (
          <Button variant="outline" disabled={busy || isSelf || isAdmin} onClick={() => act("suspend", `Suspend ${publicId}? Their sessions end immediately.`)}>
            Suspend
          </Button>
        ) : (
          <Button variant="outline" disabled={busy} onClick={() => act("reactivate", `Reactivate ${publicId}?`)}>
            Reactivate
          </Button>
        )}
        <Button variant="outline" disabled={busy} onClick={() => act("reset-code", `Issue a one-time reset code for ${publicId}? It is valid for 24 hours.`)}>
          Issue reset code
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      {code && (
        <div className="rounded-xl border border-warn/40 bg-warn-soft p-4" data-testid="reset-code">
          <p className="text-sm font-medium">One-time reset code for {publicId}. It is shown only now.</p>
          <p className="mt-2 font-mono text-2xl tracking-widest">{code.code.match(/.{1,4}/g)!.join("-")}</p>
          <p className="mt-1 text-xs text-muted">Valid until {new Date(code.expiresAt).toLocaleString("en-GB", { timeZone: "Asia/Manila" })} (Asia/Manila). Give it to the user through a channel you trust; they enter it on the Reset password page.</p>
          <button
            type="button"
            className="mt-2 rounded-lg border border-line-2 bg-white px-3 py-1 text-sm"
            onClick={async () => {
              await navigator.clipboard.writeText(code.code).catch(() => {});
              setCopied(true);
            }}
          >
            <span aria-live="polite">{copied ? "Copied" : "Copy code"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
