import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Status chips (BRD S-01): draft grey, queued/running blue, needs confirmation amber, ready green, failed red. */
export const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "bg-na-soft text-na",
      info: "bg-info-soft text-info",
      warn: "bg-warn-soft text-warn",
      ok: "bg-ok-soft text-ok",
      bad: "bg-bad-soft text-bad",
      brand: "bg-bronze-soft text-bronze-ink",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
