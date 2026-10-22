import Link from "next/link";

export default function ReportNotFound() {
  return (
    <div className="max-w-xl space-y-3 py-10">
      <p className="eyebrow">404</p>
      <h1 className="text-3xl">Report not found</h1>
      <p className="text-muted">It may have been deleted, or it belongs to another account.</p>
      <Link href="/app/reports">Go to my reports</Link>
    </div>
  );
}
