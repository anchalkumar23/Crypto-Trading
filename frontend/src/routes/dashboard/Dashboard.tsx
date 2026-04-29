import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  DollarSign,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Sparkline } from "@/components/charts/Sparkline";
import { EquityChart } from "@/components/charts/EquityChart";
import {
  portfolios as portfolioApi,
  strategies,
  markets,
  trades as tradesApi,
} from "@/lib/api";
import { formatPct, formatRelativeTime, formatUSD, pctClass } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Dashboard() {
  const navigate = useNavigate();

  const { data: portList = [] } = useQuery({
    queryKey: ["portfolios"],
    queryFn: portfolioApi.list,
    refetchInterval: 30_000,
  });

  const { data: cryptoList = [] } = useQuery({
    queryKey: ["markets", "crypto"],
    queryFn: markets.listCrypto,
    refetchInterval: 30_000,
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["strategies", "runs"],
    queryFn: strategies.listRuns,
    refetchInterval: 30_000,
  });

  const { data: recentTrades = [] } = useQuery({
    queryKey: ["trades", "recent"],
    queryFn: () => tradesApi.list({ limit: 6 }),
    refetchInterval: 30_000,
  });

  const totalEquity = portList.reduce((s, p) => s + p.currentEquity, 0);
  const totalCash = portList.reduce((s, p) => s + p.cash, 0);
  const totalPositions = portList.reduce((s, p) => s + p.positionsValue, 0);
  const totalPnL = portList.reduce((s, p) => s + p.realizedPnl + p.unrealizedPnl, 0);
  const totalStarting = portList.reduce((s, p) => s + p.startingCash, 0);
  const totalReturn = totalStarting > 0 ? (totalPnL / totalStarting) * 100 : 0;
  const activeRuns = runs.filter((r) => r.status === "running").length;

  // Use the portfolio with the most equity points for the combined chart
  const curveSource = portList.reduce(
    (best, p) => (p.equityCurve.length > (best?.equityCurve.length ?? 0) ? p : best),
    portList[0],
  );
  const equityCurve = curveSource?.equityCurve ?? [];

  const topMovers = [...cryptoList]
    .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <>
            Welcome back, <span className="gradient-text">Trader</span>
          </>
        }
        subtitle="Your paper-trading lab — markets, strategies, and portfolios at a glance."
        actions={
          <>
            <Button variant="secondary" size="md" onClick={() => navigate("/strategies")}>
              <Activity className="h-4 w-4" />
              View runs
            </Button>
            <Button variant="primary" size="md" onClick={() => navigate("/strategies")}>
              <Zap className="h-4 w-4" />
              New strategy run
            </Button>
          </>
        }
      />

      {/* Top stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Equity"
          value={formatUSD(totalEquity)}
          delta={totalReturn}
          deltaLabel={`${formatUSD(totalPnL, { decimals: 2 })} all time`}
          icon={Wallet}
          spark={equityCurve.slice(-30).map((c) => c.v)}
        />
        <StatCard
          label="Cash Available"
          value={formatUSD(totalCash)}
          icon={DollarSign}
          hint="Across all paper portfolios"
        />
        <StatCard
          label="Open Positions Value"
          value={formatUSD(totalPositions)}
          icon={TrendingUp}
          hint={`${portList.reduce((s, p) => s + p.positions.length, 0)} positions open`}
        />
        <StatCard
          label="Active Strategy Runs"
          value={activeRuns.toString()}
          icon={Activity}
          deltaLabel={`${runs.length} total runs`}
        />
      </div>

      {/* Equity curve + active runs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Portfolio Equity</CardTitle>
              <p className="text-2xs text-ink-muted mt-0.5 uppercase tracking-wider">
                {curveSource?.name ?? "No portfolios yet"}
              </p>
            </div>
            <Badge tone={totalReturn >= 0 ? "bull" : "bear"} dot>
              {formatPct(totalReturn)} all time
            </Badge>
          </CardHeader>
          <CardContent className="!p-0 !pb-3">
            {equityCurve.length > 0 ? (
              <EquityChart data={equityCurve} height={300} color="#7c5cff" />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-sm text-ink-muted">
                Start a strategy run to populate equity data.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Strategy Runs</CardTitle>
            <Link
              to="/strategies"
              className="text-xs text-brand-glow hover:text-brand inline-flex items-center gap-1"
            >
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="!p-0">
            {runs.length === 0 ? (
              <div className="px-5 py-8 text-sm text-ink-muted text-center">
                No strategy runs yet.{" "}
                <Link to="/strategies" className="text-brand-glow hover:text-brand">
                  Start one
                </Link>
                .
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {runs.map((r) => (
                  <li
                    key={r.id}
                    className="px-5 py-3 flex items-center justify-between hover:bg-bg-hover transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink truncate">
                        {r.strategyName}
                      </div>
                      <div className="text-2xs text-ink-muted truncate">{r.portfolioName}</div>
                    </div>
                    <div className="text-right ml-2">
                      <div className={cn("text-sm font-semibold num", pctClass(r.pnl))}>
                        {formatUSD(r.pnl, { decimals: 2 })}
                      </div>
                      <div className="text-2xs text-ink-muted flex items-center gap-1 justify-end mt-0.5">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            r.status === "running" && "bg-bull animate-pulse",
                            r.status === "paused" && "bg-warn",
                            r.status === "errored" && "bg-bear",
                            r.status === "stopped" && "bg-ink-subtle",
                          )}
                        />
                        {r.status === "running"
                          ? `tick ${formatRelativeTime(r.lastTickAt)}`
                          : r.status}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top movers + Recent trades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Top Movers · 24h</CardTitle>
            <Link
              to="/markets"
              className="text-xs text-brand-glow hover:text-brand inline-flex items-center gap-1"
            >
              All markets <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="!p-0">
            {topMovers.length === 0 ? (
              <div className="px-5 py-8 text-sm text-ink-muted text-center">Loading…</div>
            ) : (
              <ul className="divide-y divide-border">
                {topMovers.map((m) => (
                  <li key={m.symbol}>
                    <Link
                      to={`/markets/${encodeURIComponent(m.symbol)}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-bg-hover transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-bg-hover grid place-items-center text-2xs font-bold text-ink-muted">
                          {m.base.slice(0, 3)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-ink">{m.symbol}</div>
                          <div className="text-2xs text-ink-muted">{m.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold num text-ink">
                          {formatUSD(m.price)}
                        </div>
                        <div className={cn("text-xs num font-medium", pctClass(m.change24h))}>
                          {formatPct(m.change24h)}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Trades</CardTitle>
            <Badge tone="brand" dot>
              Live feed
            </Badge>
          </CardHeader>
          <CardContent className="!p-0">
            {recentTrades.length === 0 ? (
              <div className="py-8 text-center text-sm text-ink-muted">
                No trades yet. Start a strategy run to see activity here.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentTrades.map((t) => (
                  <li
                    key={t.id}
                    className="grid grid-cols-12 gap-3 px-5 py-3 hover:bg-bg-hover transition-colors items-center"
                  >
                    <div className="col-span-3 sm:col-span-2">
                      <Badge tone={t.side === "buy" ? "bull" : "bear"}>
                        {t.side.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <div className="text-sm font-medium text-ink">{t.symbol}</div>
                    </div>
                    <div className="col-span-6 sm:col-span-3 text-2xs text-ink-muted truncate">
                      {t.strategyName}
                    </div>
                    <div className="hidden sm:block sm:col-span-3 text-xs text-ink-muted num">
                      {t.qty.toFixed(4)} @ {formatUSD(t.price)}
                    </div>
                    <div className="hidden sm:block sm:col-span-2 text-xs text-ink-muted text-right num">
                      {formatRelativeTime(t.ts)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Portfolio performance */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Portfolio Performance</CardTitle>
            <p className="text-2xs text-ink-muted mt-0.5 uppercase tracking-wider">
              Equity curves
            </p>
          </div>
          <Link
            to="/portfolios"
            className="text-xs text-brand-glow hover:text-brand inline-flex items-center gap-1"
          >
            All portfolios <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="!p-0">
          {portList.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-muted">
              No portfolios yet.{" "}
              <Link to="/portfolios" className="text-brand-glow hover:text-brand">
                Create one
              </Link>{" "}
              to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
              {portList.slice(0, 3).map((p) => (
                <Link
                  key={p.id}
                  to={`/portfolios/${p.id}`}
                  className="p-5 hover:bg-bg-hover transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink truncate group-hover:text-brand-glow transition-colors">
                        {p.name}
                      </div>
                      <div className="text-2xs text-ink-muted uppercase tracking-wider mt-0.5">
                        {p.kind} · {p.trades} trades
                      </div>
                    </div>
                    <Badge tone={p.totalReturn >= 0 ? "bull" : "bear"}>
                      {formatPct(p.totalReturn)}
                    </Badge>
                  </div>
                  <div className="text-2xl font-semibold text-ink num mb-1">
                    {formatUSD(p.currentEquity)}
                  </div>
                  <div className="text-xs text-ink-muted mb-3 num">
                    Started {formatUSD(p.startingCash, { compact: true })}
                  </div>
                  {p.equityCurve.length > 0 && (
                    <Sparkline data={p.equityCurve.map((c) => c.v)} height={48} />
                  )}
                  <div className="mt-3 grid grid-cols-3 gap-2 text-2xs">
                    <div>
                      <div className="text-ink-muted uppercase tracking-wider">Win rate</div>
                      <div className="text-ink num font-medium mt-0.5">
                        {p.winRate.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-ink-muted uppercase tracking-wider">Realized</div>
                      <div className={cn("num font-medium mt-0.5", pctClass(p.realizedPnl))}>
                        {formatUSD(p.realizedPnl, { decimals: 0 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-ink-muted uppercase tracking-wider">Open</div>
                      <div className="text-ink num font-medium mt-0.5">
                        {p.positions.length}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
