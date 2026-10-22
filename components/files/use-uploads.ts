"use client";
/**
 * Upload state for one report (BRD 9.1). Lives in the form, not in the Documents step, so uploads keep
 * going while the user moves between steps; `busy` keeps Generate disabled until every file is done.
 * Production uploads go straight from the browser to UploadThing (UP-01; the client is loaded only when
 * the first file is added). driver "local" posts to /api/dev-uploads (tests and offline work).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { checkFile, DOCUMENT_RULES, type DocType } from "@/lib/files/config";
import type { UploadRouter } from "@/lib/files/uploadthing-router";

export type ServerFile = { id: string; name: string; mimeType: string; sizeBytes: number; docType: string | null; createdAt: string };

export type UploadItem = {
  localId: string;
  fileId: string | null;
  name: string;
  size: number;
  docType: string | null;
  status: "uploading" | "done" | "error" | "rejected";
  progress: number;
  error: string | null;
};

type Abort = { abort: () => void };

let seq = 0;
const nextId = () => `u${++seq}`;

async function uploadThing(file: File, input: { reportId: string; docType: DocType | null }, signal: AbortSignal, onProgress: (p: number) => void) {
  const { genUploader } = await import("uploadthing/client");
  const { uploadFiles } = genUploader<UploadRouter>({ url: "/api/uploadthing", package: "@uploadthing/react" });
  const [res] = await uploadFiles("documents", { files: [file], input, signal, onUploadProgress: ({ progress }) => onProgress(progress) });
  const fileId = (res?.serverData as { fileId?: string | null } | undefined)?.fileId ?? null;
  if (!fileId) throw new Error("The upload finished but was not recorded. Try again.");
  return fileId;
}

function uploadLocal(file: File, input: { reportId: string; docType: DocType | null }, onProgress: (p: number) => void): Promise<string> & Abort {
  const xhr = new XMLHttpRequest();
  const p = new Promise<string>((resolve, reject) => {
    const form = new FormData();
    form.set("file", file);
    form.set("reportId", input.reportId);
    if (input.docType) form.set("docType", input.docType);
    xhr.open("POST", "/api/dev-uploads");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const body = (() => {
        try {
          return JSON.parse(xhr.responseText);
        } catch {
          return {};
        }
      })();
      if (xhr.status === 201 && body?.file?.id) resolve(body.file.id);
      else reject(new Error(body?.error?.message ?? "The upload failed. Try again."));
    };
    xhr.onerror = () => reject(new Error("The upload failed. Check your connection and try again."));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    xhr.send(form);
  });
  return Object.assign(p, { abort: () => xhr.abort() });
}

export function useUploads(opts: { reportId: string; driver: "uploadthing" | "local"; initial: ServerFile[]; locked?: boolean }) {
  const [items, setItems] = useState<UploadItem[]>(() =>
    opts.initial.map((f) => ({ localId: nextId(), fileId: f.id, name: f.name, size: f.sizeBytes, docType: f.docType, status: "done", progress: 100, error: null })),
  );
  const aborts = useRef(new Map<string, Abort>());

  const patch = useCallback((localId: string, p: Partial<UploadItem>) => setItems((list) => list.map((i) => (i.localId === localId ? { ...i, ...p } : i))), []);

  const add = useCallback(
    (files: File[], docType: DocType | null = null) => {
      let count = items.filter((i) => i.status === "done" || i.status === "uploading").length;
      const added: UploadItem[] = [];
      for (const file of files) {
        const reason = checkFile(file, count + 1);
        const item: UploadItem = { localId: nextId(), fileId: null, name: file.name, size: file.size, docType, status: reason ? "rejected" : "uploading", progress: 0, error: reason };
        added.push(item);
        if (reason) continue;
        count++;
        const input = { reportId: opts.reportId, docType };
        const onProgress = (p: number) => patch(item.localId, { progress: Math.min(99, p) });
        const finish = (job: Promise<string>) =>
          job.then(
            (fileId) => patch(item.localId, { fileId, status: "done", progress: 100 }),
            (err: unknown) => {
              if (err instanceof DOMException && err.name === "AbortError") return;
              patch(item.localId, { status: "error", error: err instanceof Error ? err.message : "The upload failed." });
            },
          ).finally(() => aborts.current.delete(item.localId));
        if (opts.driver === "local") {
          const job = uploadLocal(file, input, onProgress);
          aborts.current.set(item.localId, job);
          void finish(job);
        } else {
          const ctrl = new AbortController();
          aborts.current.set(item.localId, { abort: () => ctrl.abort() });
          void finish(uploadThing(file, input, ctrl.signal, onProgress));
        }
      }
      setItems((list) => [...list, ...added]);
    },
    [items, opts.reportId, opts.driver, patch],
  );

  const remove = useCallback(
    async (item: UploadItem) => {
      if (item.status === "uploading") {
        aborts.current.get(item.localId)?.abort();
        setItems((list) => list.filter((i) => i.localId !== item.localId));
        return;
      }
      if (item.fileId) {
        patch(item.localId, { error: null });
        const res = await fetch(`/api/files/${item.fileId}`, { method: "DELETE" });
        if (!res.ok && res.status !== 404) {
          const body = await res.json().catch(() => ({}));
          patch(item.localId, { error: body?.error?.message ?? "The file could not be removed." });
          return;
        }
      }
      setItems((list) => list.filter((i) => i.localId !== item.localId));
    },
    [patch],
  );

  const setDocType = useCallback(
    async (item: UploadItem, docType: string | null) => {
      patch(item.localId, { docType });
      if (!item.fileId) return;
      const res = await fetch(`/api/files/${item.fileId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ docType }),
      });
      if (!res.ok) patch(item.localId, { error: "The document type could not be saved." });
    },
    [patch],
  );

  const busy = items.some((i) => i.status === "uploading");
  const docs = useMemo(() => Object.fromEntries(items.filter((i) => i.status === "done" && i.docType).map((i) => [i.docType!, true])), [items]);
  const stored = items.filter((i) => i.status === "done").length;
  return { items, add, remove, setDocType, busy, docs, stored, remaining: DOCUMENT_RULES.maxFiles - stored, locked: !!opts.locked };
}

export type Uploads = ReturnType<typeof useUploads>;
