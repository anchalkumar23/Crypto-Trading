import { Search, Bell, Power, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useEngineStatus } from "@/hooks/useEngineStatus";
import { kill } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TopBar() {
  const engine = useEngineStatus();

  async function onKill() {
    if (!window.confirm("Halt every running strategy and disable live trading?")) return;
    try {
      const res = await kill.trigger();
      window.alert(`Kill switch fired — ${res.stopped} run(s) stopped.`);
    } catch {
      window.alert("Kill switch failed (is the backend running?).");
    }
  }

  return (
    <header className="h-14 border-b border-border bg-bg/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle pointer-events-none" />
          <input
            type="text"
            placeholder="Search markets, strategies, runs…"
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-bg-subtle border border-border text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition-colors"
          />
          <kbd className="hidden sm:inline absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-ink-subtle bg-bg-card border border-border rounded px-1.5 py-0.5 font-mono">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden lg:flex items-center gap-1.5 rounded-lg border border-border bg-bg-subtle px-2.5 py-1.5">
          <div
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              engine.connected ? "bg-bull animate-pulse" : "bg-ink-subtle",
            )}
          />
          <span className="text-xs text-ink-muted">
            {engine.connected ? "Engine ticking" : "Engine offline"}
          </span>
          {engine.lastTickAt && (
            <span className="text-xs text-ink num">
              · {formatRelativeTime(engine.lastTickAt)}
            </span>
          )}
        </div>

        <Button
          variant="danger"
          size="sm"
          className="hidden sm:inline-flex"
          onClick={onKill}
        >
          <Power className="h-3.5 w-3.5" />
          Kill switch
        </Button>

        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>

        <button className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-bg-hover transition-colors">
          <div className="h-7 w-7 rounded-full bg-brand-gradient grid place-items-center text-xs font-bold text-white">
            VL
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-ink-muted hidden sm:block" />
        </button>
      </div>
    </header>
  );
}
