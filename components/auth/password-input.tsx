"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

/** Password field with a show/hide toggle. Paste is always allowed (AU-02). */
export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className="pr-16" />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-pressed={shown}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-bronze-ink hover:text-navy"
      >
        {shown ? "Hide" : "Show"}
        <span className="sr-only"> password</span>
      </button>
    </div>
  );
}
