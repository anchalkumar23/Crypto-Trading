import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  LineChart,
  TrendingUp,
  Wallet,
  Beaker,
  History,
  Settings as SettingsIcon,
  ShieldAlert,
} from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/markets", icon: LineChart, label: "Crypto Markets" },
  { to: "/polymarket", icon: TrendingUp, label: "Polymarket" },
  { to: "/portfolios", icon: Wallet, label: "Portfolios" },
  { to: "/strategies", icon: Beaker, label: "Strategies" },
  { to: "/backtests", icon: History, label: "Backtests" },
  { to: "/settings", icon: SettingsIcon, label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-border bg-bg-subtle/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <Logo size={32} />
        <div>
          <div className="text-sm font-bold text-ink leading-tight">Vega Lab</div>
          <div className="text-2xs uppercase tracking-wider text-ink-muted leading-tight">
            Research · Paper trade
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <div className="px-3 pb-2 text-2xs uppercase tracking-wider text-ink-subtle font-medium">
          Workspace
        </div>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group",
                isActive
                  ? "bg-brand/12 text-ink shadow-[inset_0_0_0_1px_rgba(124,92,255,0.25)]"
                  : "text-ink-muted hover:text-ink hover:bg-bg-hover",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "h-4 w-4 flex-shrink-0 transition-colors",
                    isActive ? "text-brand-glow" : "text-ink-subtle group-hover:text-ink-muted",
                  )}
                />
                <span className="font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-4">
        <div className="rounded-xl border border-warn/30 bg-warn-bg p-3">
          <div className="flex items-center gap-2 text-warn font-semibold text-xs">
            <ShieldAlert className="h-3.5 w-3.5" />
            Live trading: OFF
          </div>
          <p className="text-2xs text-ink-muted mt-1.5 leading-relaxed">
            All trades are simulated. Toggle in Settings — caps & confirms required.
          </p>
        </div>
      </div>
    </aside>
  );
}
