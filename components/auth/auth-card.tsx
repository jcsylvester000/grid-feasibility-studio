export function AuthCard({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
      <h1 className="text-3xl">{title}</h1>
      {lead && <p className="mt-2 text-sm text-muted">{lead}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
      {message}
    </p>
  );
}
