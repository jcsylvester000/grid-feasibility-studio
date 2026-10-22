import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// B0 placeholder. The real Home page (P-01) arrives in batch B1.
export default function Home() {
  return (
    <main className="min-h-dvh bg-navy text-white">
      <div className="container-page flex min-h-dvh flex-col justify-center gap-8 py-16">
        <div className="w-fit rounded-md bg-white px-3 py-2">
          <Image src="/grid-logo.png" alt="GRID Property Ventures" width={150} height={60} priority />
        </div>
        <p className="eyebrow !text-gold">GRID Feasibility Studio · build B0</p>
        <h1 className="max-w-3xl text-4xl leading-tight sm:text-5xl">
          Sourced feasibility reports for Philippine property, in minutes.
        </h1>
        <p className="max-w-2xl text-mist">
          The foundation is in place. Public pages, accounts and reports arrive batch by batch.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/design" className={buttonVariants({ variant: "primary", size: "lg" })}>
            View design tokens
          </Link>
          <a href="/api/health" className={buttonVariants({ variant: "ghost-light", size: "lg" })}>
            Health check
          </a>
        </div>
      </div>
    </main>
  );
}
