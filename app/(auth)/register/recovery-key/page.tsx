import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { CopyButton } from "@/components/auth/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { formatRecoveryKey } from "@/lib/auth/ids";
import { readRecoveryKeyFlash, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Save your recovery key", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function RecoveryKeyPage({
  searchParams,
}: {
  searchParams: Promise<{ confirm?: string; from?: string }>;
}) {
  const { user } = await requireUser("/register/recovery-key");
  const { confirm, from } = await searchParams;
  const key = await readRecoveryKeyFlash(user.id);

  if (!key) {
    return (
      <AuthCard title="This key is no longer shown" lead="For your safety, a recovery key is shown only once.">
        <p className="text-sm text-muted">
          If you did not save it, you can create a new key from your Account page after entering your password.
        </p>
        <Link href={user.role === "admin" ? "/admin" : "/app"} className={buttonVariants({ className: "mt-6 w-full" })}>
          Continue
        </Link>
      </AuthCard>
    );
  }

  const formatted = formatRecoveryKey(key);
  return (
    <AuthCard
      title="Save your recovery key"
      lead={
        from === "reset"
          ? "Your password was changed and your old key no longer works. Save this new key."
          : "There is no email on your account. This key is the only way to reset your password yourself."
      }
    >
      <div className="rounded-xl bg-navy p-5 text-center">
        <p className="eyebrow !text-gold">Recovery key</p>
        <p data-testid="recovery-key" className="mt-3 whitespace-nowrap font-mono text-base tracking-[0.06em] text-white min-[400px]:text-lg sm:text-xl">
          {formatted.split("-").map((g, i) => (
            <span key={i} className="inline-block px-0.5 sm:px-1">
              {g}
            </span>
          ))}
        </p>
        <p className="mt-4 text-sm text-mist">
          User ID <span data-testid="public-id" className="font-mono text-gold">{user.publicId}</span>
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <CopyButton text={`${formatted}  (User ID ${user.publicId})`} />
        <a href="/api/account/recovery-key/download" download className={buttonVariants({ variant: "outline" })}>
          Download
        </a>
      </div>
      <form method="post" action="/api/account/recovery-key/continue" className="mt-6 space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="saved" required className="mt-0.5 size-4 accent-[var(--color-navy)]" />
          <span>I have saved my recovery key.</span>
        </label>
        {confirm && (
          <p role="alert" className="text-sm text-bad">
            Please tick the box to confirm you saved the key.
          </p>
        )}
        <button type="submit" className={buttonVariants({ size: "lg", className: "w-full" })}>
          Continue
        </button>
      </form>
      <p className="mt-4 text-xs text-muted">
        Keep your User ID too: GRID support asks for it if you ever lose this key.
      </p>
    </AuthCard>
  );
}
