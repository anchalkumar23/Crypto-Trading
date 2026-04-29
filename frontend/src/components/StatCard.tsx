import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { Sparkline } from "./charts/Sparkline";

interface StatCardProps {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  icon?: LucideIcon;
  spark?: number[];
  hint?: string;
}

export function StatCard({ label, value, delta, deltaLabel, icon: Icon, spark, hint }: StatCardProps) {
  const isUp = delta !== undefined && delta > 0;
  const isDown = delta !== undefined && delta < 0;
  return (
    <Card className="card-hover overflow-hidden">
      <CardContent className="!p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-ink-subtle" />}
            <span className="stat-label">{label}</span>
          </div>
          {delta !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-semibold num",
                isUp && "text-bull",
                isDown && "text-bear",
                !isUp && !isDown && "text-ink-muted",
              )}
            >
              {isUp && <ArrowUp className="h-3 w-3" />}
              {isDown && <ArrowDown className="h-3 w-3" />}
              {Math.abs(delta).toFixed(2)}%
            </span>
          )}
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <div className="stat-value">{value}</div>
            {(deltaLabel || hint) && (
              <div className="text-xs text-ink-muted mt-0.5">{deltaLabel ?? hint}</div>
            )}
          </div>
          {spark && spark.length > 0 && (
            <div className="w-24 -mr-1">
              <Sparkline data={spark} height={36} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
