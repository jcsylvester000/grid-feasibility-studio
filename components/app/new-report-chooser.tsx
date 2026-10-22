"use client";

import { useState } from "react";
import { ProductCard, type ProductCardData } from "./product-card";

type Answer = "yes" | "no" | "";

function Question({ name, label, value, set }: { name: string; label: string; value: Answer; set: (a: Answer) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex gap-2">
        {(["yes", "no"] as const).map((a) => (
          <label
            key={a}
            className="cursor-pointer rounded-lg border border-line-2 bg-white px-4 py-2 text-sm has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-panel"
          >
            <input type="radio" name={name} value={a} checked={value === a} onChange={() => set(a)} className="sr-only" />
            {a === "yes" ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** S-02 two-question helper: highlights the product that fits. Works without JavaScript (no highlight). */
export function NewReportChooser({ products }: { products: ProductCardData[] }) {
  const [costs, setCosts] = useState<Answer>("");
  const [full, setFull] = useState<Answer>("");
  const suggested = full === "yes" ? "feasibility_report" : full === "no" ? (costs === "yes" ? "executive_summary" : "quick_report") : "";

  return (
    <div className="space-y-8">
      <div className="grid gap-6 rounded-[var(--radius-card)] border border-line bg-sand p-5 sm:grid-cols-2">
        <Question name="costs" label="Do you have cost and funding figures?" value={costs} set={setCosts} />
        <Question name="full" label="Do you need a full study?" value={full} set={setFull} />
        <p className="text-sm text-muted sm:col-span-2" aria-live="polite">
          {suggested ? `Suggested: ${products.find((p) => p.key === suggested)?.name}.` : "Answer both questions for a suggestion, or pick any report below."}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {products.map((p) => (
          <ProductCard key={p.key} p={p} detailed highlighted={p.key === suggested} />
        ))}
      </div>
    </div>
  );
}
