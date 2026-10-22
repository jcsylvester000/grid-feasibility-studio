import Link from "next/link";
import { Logo } from "@/components/site/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <header className="border-b-[3px] border-bronze bg-navy">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          <Link href="/" className="text-sm text-mist no-underline hover:text-gold">
            Back to home
          </Link>
        </div>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        {children}
      </main>
    </div>
  );
}
