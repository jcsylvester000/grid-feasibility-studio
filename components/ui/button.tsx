import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button (shadcn/ui pattern, GRID tokens). Primary = navy text on bronze (5.6:1, WCAG AA);
 * white on bronze is only 3.1:1 and is not used.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium no-underline transition-colors " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel " +
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-bronze text-navy hover:bg-gold",
        dark: "bg-navy text-white hover:bg-panel",
        outline: "border border-line-2 bg-white text-ink hover:border-bronze",
        ghost: "text-ink hover:bg-sand",
        "ghost-light": "border border-white/25 text-white hover:border-gold hover:text-gold",
        link: "text-bronze-ink underline underline-offset-2 hover:text-navy",
        danger: "bg-bad text-white hover:bg-[#8f2e2e]",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
