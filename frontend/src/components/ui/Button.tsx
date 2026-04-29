import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-glow shadow-[0_0_0_1px_rgba(124,92,255,0.4),0_4px_24px_-8px_rgba(124,92,255,0.5)]",
  secondary: "bg-bg-hover text-ink border border-border hover:border-border-strong",
  ghost: "text-ink-muted hover:text-ink hover:bg-bg-hover",
  danger:
    "bg-bear text-white hover:bg-bear-dim shadow-[0_0_0_1px_rgba(239,68,68,0.4),0_4px_24px_-8px_rgba(239,68,68,0.5)]",
  outline: "border border-border text-ink hover:bg-bg-hover hover:border-border-strong",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-10 px-5 text-sm gap-2",
  icon: "h-9 w-9",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
        "disabled:opacity-50 disabled:pointer-events-none",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
