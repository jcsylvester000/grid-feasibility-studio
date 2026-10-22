"use client";
/**
 * Document drop zone (BRD 9.1): drag and drop or choose files (on phones this opens the camera roll and
 * the file picker), per-file progress, a document-type select, remove, and plain error text for type,
 * size or count.
 */
import { FileText, UploadCloud, X } from "lucide-react";
import { useId, useState } from "react";
import { DOC_TYPES, DOCUMENT_RULES, formatBytes, TEASER_RULES } from "@/lib/files/config";
import { cn } from "@/lib/utils";
import type { UploadItem, Uploads } from "./use-uploads";

const ACCEPT = {
  documents: [...DOCUMENT_RULES.mimes, ...DOCUMENT_RULES.extensions].join(","),
  teaserMedia: [...TEASER_RULES.mimes, ...TEASER_RULES.extensions].join(","),
};
const HELP = {
  documents: "PDF, JPG, PNG or HEIC · up to 25 MB each",
  teaserMedia: "Images or PDF up to 25 MB · MP4 or MOV video up to 200 MB and 3 minutes",
};

export function DropZone({ uploads }: { uploads: Uploads }) {
  const inputId = useId();
  const [over, setOver] = useState(false);
  const full = uploads.remaining <= 0;
  const disabled = full || uploads.locked;

  return (
    <div className="space-y-3" data-testid="drop-zone">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) uploads.add(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center",
          over ? "border-bronze bg-bronze-soft" : "border-line-2 bg-cream",
          disabled && "opacity-60",
        )}
      >
        <UploadCloud aria-hidden className="size-7 text-bronze-ink" />
        <p className="text-sm">
          <label htmlFor={inputId} className={cn("cursor-pointer font-medium text-bronze-ink underline", disabled && "pointer-events-none")}>
            Choose files
          </label>{" "}
          or drop them here
        </p>
        <p className="text-xs text-muted">
          {HELP[uploads.route]} · up to {DOCUMENT_RULES.maxFiles} files ({uploads.remaining} left)
        </p>
        <input
          id={inputId}
          type="file"
          multiple
          accept={ACCEPT[uploads.route]}
          disabled={disabled}
          className="sr-only"
          data-testid="file-input"
          onChange={(e) => {
            uploads.add(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {uploads.locked && <p className="text-sm text-muted">Files cannot change while the report is being prepared.</p>}

      {uploads.items.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line bg-white" aria-label="Files">
          {uploads.items.map((item) => (
            <FileRow key={item.localId} item={item} uploads={uploads} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FileRow({ item, uploads }: { item: UploadItem; uploads: Uploads }) {
  const selectId = useId();
  const failed = item.status === "error" || item.status === "rejected";
  return (
    <li className="space-y-2 px-3 py-3" data-testid="file-row" data-status={item.status}>
      <div className="flex items-start gap-2">
        <FileText aria-hidden className={cn("mt-0.5 size-4 shrink-0", failed ? "text-bad" : "text-muted")} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={item.name}>
            {item.fileId && item.status === "done" ? (
              <button type="button" className="max-w-full truncate text-left underline-offset-2 hover:underline" onClick={() => openFile(item.fileId!)}>
                {item.name}
              </button>
            ) : (
              item.name
            )}
          </p>
          <p className="text-xs text-muted">
            {formatBytes(item.size)}
            {item.status === "uploading" && ` · uploading ${item.progress}%`}
            {item.status === "done" && " · uploaded"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void uploads.remove(item)}
          disabled={uploads.locked && item.status === "done"}
          className="relative inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm text-ink-2 hover:bg-sand"
        >
          <X aria-hidden className="size-4" />
          {item.status === "uploading" ? "Cancel" : item.status === "rejected" ? "Dismiss" : "Remove"}
          <span className="sr-only"> {item.name}</span>
        </button>
      </div>
      {item.status === "uploading" && (
        <div role="progressbar" aria-label={`Uploading ${item.name}`} aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full overflow-hidden rounded-full bg-sand">
          <div className="h-full bg-bronze transition-[width]" style={{ width: `${item.progress}%` }} />
        </div>
      )}
      {item.status !== "rejected" && uploads.route === "documents" && (
        <div className="pl-6">
          <label htmlFor={selectId} className="sr-only">
            What is {item.name}?
          </label>
          <select
            id={selectId}
            value={item.docType ?? ""}
            disabled={uploads.locked}
            onChange={(e) => void uploads.setDocType(item, e.target.value || null)}
            className="h-9 w-full max-w-xs rounded-lg border border-line-2 bg-white px-2 text-sm"
          >
            <option value="">What is this document?</option>
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {item.error && (
        <p role="alert" className="pl-6 text-sm text-bad">
          {item.error}
        </p>
      )}
    </li>
  );
}

async function openFile(fileId: string) {
  const w = window.open("about:blank", "_blank");
  const res = await fetch(`/api/files/${fileId}/url`);
  const body = await res.json().catch(() => ({}));
  if (res.ok && body.url && w) w.location.href = body.url;
  else w?.close();
}
