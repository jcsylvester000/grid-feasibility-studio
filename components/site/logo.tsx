import Image from "next/image";
import Link from "next/link";

/** GRID logo on a white chip (the logo artwork has a white background). */
export function Logo({ priority = false }: { priority?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-3 no-underline" aria-label="GRID Feasibility Studio home">
      <span className="rounded-md bg-white px-2 py-1">
        <Image src="/grid-logo.png" alt="GRID Property Ventures" width={90} height={36} priority={priority} />
      </span>
      <span className="hidden flex-col leading-none sm:flex">
        <span className="font-display text-[17px] text-white">Feasibility Studio</span>
      </span>
    </Link>
  );
}
