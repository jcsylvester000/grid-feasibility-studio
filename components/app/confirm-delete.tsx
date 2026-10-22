import { deleteReportAction } from "@/app/app/actions";

/** Two-step delete with no JavaScript: <details> reveals the confirmation (S-06 rule 2). */
export function ConfirmDelete({ id, title, back }: { id: string; title: string; back?: string }) {
  return (
    <details className="group relative">
      <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-sm text-bad hover:bg-bad-soft [&::-webkit-details-marker]:hidden">
        Delete<span className="sr-only"> {title}</span>
      </summary>
      <div className="right-0 z-20 mt-2 w-64 rounded-xl border border-line bg-white p-4 text-left shadow-lg md:absolute md:w-72">
        <p className="text-sm">
          Delete <strong>{title}</strong>? Its runs, results and files are removed too. This cannot be undone.
        </p>
        <form action={deleteReportAction} className="mt-3 flex justify-end">
          <input type="hidden" name="id" value={id} />
          {back && <input type="hidden" name="back" value={back} />}
          <button type="submit" className="rounded-lg bg-bad px-3 py-1.5 text-sm font-medium text-white hover:bg-[#8f2e2e]">
            Yes, delete
          </button>
        </form>
      </div>
    </details>
  );
}
