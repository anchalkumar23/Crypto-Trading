import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  RotateCcw,
  Wallet,
  Activity,
  TrendingUp,
  PieChart,
  Percent,
  Loader2,
  Trash2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EquityChart } from "@/components/charts/EquityChart";
import { StatCard } from "@/components/StatCard";
import { portfolios as portfolioApi, trades as tradesApi } from "@/lib/api";
import { formatPct, formatRelativeTime, formatUSD, pctClass } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: portfolio, isLoading, isError } = useQuery({
    queryKey: ["portfolios", id],
    queryFn: () => portfolioApi.get(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const { data: portTrades = [] } = useQuery({
    queryKey: ["trades", "portfolio", id],
    queryFn: () => tradesApi.list({ portfolio_id: id, limit: 50 }),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const resetMutation = useMutation({
    mutationFn: () => portfolioApi.reset(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["portfolios", id] });
      queryClient.invalidateQueries({ queryKey: ["trades", "portfolio", id] });
      setConfirmReset(false);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => portfolioApi.archive(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      navigate("/portfolios");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-ink-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading portfolio…</span>
      </div>
    );
  }

  if (isError || !portfolio) {
    return (
      <div className="text-center py-24">
        <h2 className="text-xl text-ink mb-2">Portfolio not found</h2>
        <Link to="/portfolios" className="text-brand-glow hover:text-brand text-sm">
          ← Back to Portfolios
        </Link>
      </div>
    );
  }

  const totalPnL = portfolio.realizedPnl + portfolio.unrealizedPnl;
  const benchmark = portfolio.equityCurve.map((p, i) => ({
    t: p.t,
    v: portfolio.startingCash * (1 + i * 0.0006),
  }));

  return (
    <div className="space-y-5">
      <Link
        to="/portfolios"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        Portfolios
        <ChevronRight className="h-3 w-3 text-ink-subtle" />
        <span className="text-ink">{portfolio.name}</span>
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-lg bg-brand-gradient grid place-items-center">
              <Wallet className="h-5 w-5 text-white" />
            </span>
            {portfolio.name}
          </span>
        }
        subtitle={
          <span className="flex items-center gap-2 mt-1">
            <Badge tone={portfolio.kind === "paper" ? "info" : "warn"}>
              {portfolio.kind} portfolio
            </Badge>
            <span className="text-ink-muted">
              · Started {formatUSD(portfolio.startingCash)} ·{" "}
              {Math.round((Date.now() - portfolio.createdAt) / 86400000)} days ago
            </span>
          </span>
        }
        actions={
          <>
            {confirmReset ? (
              <>
                <span className="text-xs text-warn">Reset all positions?</span>
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => resetMutation.mutate()}
                  disabled={resetMutation.isPending}
                >
                  {resetMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Confirm reset
                </Button>
                <Button variant="secondary" size="md" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
              </>
            ) : confirmDelete ? (
              <>
                <span className="text-xs text-bear">Archive this portfolio?</span>
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => archiveMutation.mutate()}
                  disabled={archiveMutation.isPending}
                >
                  {archiveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Confirm archive
                </Button>
                <Button variant="secondary" size="md" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setConfirmReset(true)}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Archive
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate("/strategies")}
                >
                  <Activity className="h-4 w-4" />
                  Attach strategy
                </Button>
              </>
            )}
          </>
        }
      />

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Equity"
          value={formatUSD(portfolio.currentEquity)}
          delta={portfolio.totalReturn}
          icon={Wallet}
          spark={portfolio.equityCurve.slice(-30).map((c) => c.v)}
        />
        <StatCard
          label="Total P&L"
          value={formatUSD(totalPnL)}
          icon={TrendingUp}
          hint={`${formatUSD(portfolio.realizedPnl)} realized`}
        />
        <StatCard
          label="Win Rate"
          value={`${portfolio.winRate.toFixed(1)}%`}
          icon={Percent}
          hint={`${portfolio.trades} trades total`}
        />
        <StatCard
          label="Cash · Positions"
          value={`${formatUSD(portfolio.cash, { compact: true })} · ${formatUSD(portfolio.positionsValue, { compact: true })}`}
          icon={PieChart}
          hint={`${portfolio.positions.length} open positions`}
        />
      </div>

      {/* Equity chart + risk caps */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Equity Curve</CardTitle>
              <p className="text-2xs text-ink-muted mt-0.5 uppercase tracking-wider">
                vs. cash benchmark
              </p>
            </div>
            <Badge tone={portfolio.totalReturn >= 0 ? "bull" : "bear"} dot>
              {formatPct(portfolio.totalReturn)}
            </Badge>
          </CardHeader>
          <CardContent className="!p-0 !pb-3">
            {portfolio.equityCurve.length > 0 ? (
              <EquityChart data={portfolio.equityCurve} benchmark={benchmark} height={300} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-sm text-ink-muted">
                Equity data will appear after the first engine tick.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Caps</CardTitle>
            <Badge tone="brand">Server-enforced</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <RiskRow label="Max position size" value={`${portfolio.maxPositionPct}%`} />
            <RiskRow label="Max open positions" value={portfolio.maxOpenPositions.toString()} />
            <RiskRow
              label="Daily loss limit"
              value={formatUSD(portfolio.dailyLossLimit)}
            />
            <RiskRow label="Fee rate" value={`${(portfolio.feeRate * 100).toFixed(2)}%`} />
            <RiskRow label="Slippage" value={`${portfolio.slippageBps} bps`} />
          </CardContent>
        </Card>
      </div>

      {/* Positions */}
      <Card>
        <CardHeader>
          <CardTitle>Open Positions</CardTitle>
          <Badge tone="neutral" dot>
            {portfolio.positions.length} active
          </Badge>
        </CardHeader>
        <CardContent className="!p-0">
          {portfolio.positions.length > 0 ? (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Symbol</TH>
                  <TH className="text-right">Qty</TH>
                  <TH className="text-right">Avg Price</TH>
                  <TH className="text-right">Current</TH>
                  <TH className="text-right">Market Value</TH>
                  <TH className="text-right">Unrealized P&L</TH>
                  <TH className="text-right">Opened</TH>
                </TR>
              </THead>
              <TBody>
                {portfolio.positions.map((p) => (
                  <TR key={p.symbol}>
                    <TD>
                      <Link
                        to={`/markets/${encodeURIComponent(p.symbol)}`}
                        className="text-sm text-ink hover:text-brand-glow font-medium transition-colors"
                      >
                        {p.symbol}
                      </Link>
                    </TD>
                    <TD className="text-right num">{p.qty.toFixed(4)}</TD>
                    <TD className="text-right num text-ink-muted">{formatUSD(p.avgPrice)}</TD>
                    <TD className="text-right num text-ink">{formatUSD(p.currentPrice)}</TD>
                    <TD className="text-right num text-ink">
                      {formatUSD(p.qty * p.currentPrice)}
                    </TD>
                    <TD className={cn("text-right num font-medium", pctClass(p.unrealizedPnl))}>
                      {formatUSD(p.unrealizedPnl, { decimals: 2 })}{" "}
                      <span className="text-2xs">({formatPct(p.unrealizedPct)})</span>
                    </TD>
                    <TD className="text-right text-2xs text-ink-muted">
                      {formatRelativeTime(p.openedAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <div className="py-12 text-center text-sm text-ink-muted">
              No open positions. Attach a strategy run to start trading.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trade log */}
      <Card>
        <CardHeader>
          <CardTitle>Trade Log</CardTitle>
          <span className="text-2xs text-ink-muted num">{portTrades.length} trades</span>
        </CardHeader>
        <CardContent className="!p-0">
          {portTrades.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-muted">
              No trades recorded yet.
            </div>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Time</TH>
                  <TH>Side</TH>
                  <TH>Symbol</TH>
                  <TH>Strategy</TH>
                  <TH className="text-right">Qty</TH>
                  <TH className="text-right">Price</TH>
                  <TH className="text-right">Fee</TH>
                  <TH className="text-right">Realized P&L</TH>
                </TR>
              </THead>
              <TBody>
                {portTrades.map((t) => (
                  <TR key={t.id}>
                    <TD className="text-2xs text-ink-muted">{formatRelativeTime(t.ts)}</TD>
                    <TD>
                      <Badge tone={t.side === "buy" ? "bull" : "bear"}>
                        {t.side.toUpperCase()}
                      </Badge>
                    </TD>
                    <TD className="text-ink">{t.symbol}</TD>
                    <TD className="text-ink-muted text-xs">{t.strategyName}</TD>
                    <TD className="text-right num">{t.qty.toFixed(4)}</TD>
                    <TD className="text-right num">{formatUSD(t.price)}</TD>
                    <TD className="text-right num text-ink-muted">
                      {formatUSD(t.fee, { decimals: 2 })}
                    </TD>
                    <TD className={cn("text-right num font-medium", pctClass(t.realizedPnl))}>
                      {t.realizedPnl ? formatUSD(t.realizedPnl, { decimals: 2 }) : "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RiskRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="text-ink font-medium num">{value}</span>
    </div>
  );
}
