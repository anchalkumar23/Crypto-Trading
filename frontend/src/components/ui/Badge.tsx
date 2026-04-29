import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "bull" | "bear" | "warn" | "brand" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

const toneStyles: Record<Tone, string> = {
  neutral: "bg-bg-hover text-ink-muted border-border",
  bull: "bg-bull-bg text-bull border-bull/30",
  bear: "bg-bear-bg text-bear border-bear/30",
  warn: "bg-warn-bg text-warn border-warn/30",
  brand: "bg-brand/10 text-brand-glow border-brand/30",
  info: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
};

const dotColors: Record<Tone, string> = {
  neutral: "bg-ink-subtle",
  bull: "bg-bull",
  bear: "bg-bear",
  warn: "bg-warn",
  brand: "bg-brand",
  info: "bg-cyan-400",
};

export function Badge({ className, tone = "neutral", dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn("pill", toneStyles[tone], className)} {...props}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[tone])} />}
      {children}
    </span>
  );
}
