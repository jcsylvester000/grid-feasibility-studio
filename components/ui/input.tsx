import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border border-line-2 bg-white px-3 text-[15px] text-ink placeholder:text-muted/70",
        "focus-visible:border-panel focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-panel/30",
        "aria-[invalid=true]:border-bad",
        className,
      )}
      {...props}
    />
  );
}
