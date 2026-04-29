import { useState } from "react";
import { Info, X } from "lucide-react";

export function DisclaimerBanner() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="border-b border-border bg-gradient-to-r from-brand/8 via-cyan-500/5 to-transparent px-4 lg:px-8 py-2 flex items-start gap-3">
      <Info className="h-4 w-4 text-brand-glow flex-shrink-0 mt-0.5" />
      <p className="text-xs text-ink-muted flex-1 leading-relaxed">
        <span className="text-ink font-medium">Research & education only.</span> Crypto and
        prediction-market trading carry substantial risk. Default strategies are templates,
        not signals. None of this is financial advice.
      </p>
      <button
        onClick={() => setOpen(false)}
        className="text-ink-subtle hover:text-ink transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
