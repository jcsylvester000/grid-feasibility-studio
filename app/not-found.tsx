import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center bg-cream">
      <div className="container-page max-w-xl py-16">
        <p className="eyebrow">404</p>
        <h1 className="mt-3 text-4xl">This page is not here</h1>
        <p className="mt-3 text-muted">
          The link may be old, or the page may belong to another account.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className={buttonVariants()}>Go to the home page</Link>
          <Link href="/how-it-works" className={buttonVariants({ variant: "outline" })}>How it works</Link>
        </div>
      </div>
    </main>
  );
}
