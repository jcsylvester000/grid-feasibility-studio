"use client";
import { useState } from "react";

/** Copies the seller questions as a numbered list (S-18). */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rounded-lg border border-line-2 bg-white px-2.5 py-1 text-xs font-medium hover:border-bronze"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
    >
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}
