import { legal } from "@/content/site";
import { formatDate } from "@/lib/format";

export function LegalPage({
  title,
  version,
  children,
}: {
  title: string;
  version: string;
  children: React.ReactNode;
}) {
  return (
    <article className="container-page max-w-3xl py-14">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-3 text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">Version {formatDate(version)}</p>
      <p role="note" className="mt-4 rounded-lg bg-warn-soft p-3 text-sm text-warn">
        {legal.draftNotice}
      </p>
      <div className="legal-prose mt-8">{children}</div>
    </article>
  );
}
