import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PriceChart } from "@/components/charts/PriceChart";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { markets, trades as tradesApi } from "@/lib/api";
import { formatPct, formatRelativeTime, formatUSD, pctClass } from "@/lib/format";
import { cn } from "@/lib/utils";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"] as const;

export function MarketDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const decoded = symbol ? decodeURIComponent(symbol) : "";

  const { data: market, isLoading, isError } = useQuery({
    queryKey: ["markets", "crypto", decoded],
    queryFn: () => markets.getCrypto(decoded),
    enabled: !!decoded,
    refetchInterval: 30_000,
  });

  const { data: orderbook } = useQuery({
    queryKey: ["markets", "orderbook", decoded],
    queryFn: () => markets.orderbook(decoded),
    enabled: !!decoded,
    refetchInterval: 15_000,
  });

  const { data: recentTrades = [] } = useQuery({
    queryKey: ["trades", "market", decoded],
    queryFn: () => tradesApi.list({ symbol: decoded, limit: 12 }),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-ink-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading market data…</span>
      </div>
    );
  }

  if (isError || !market) {
    return (
      <div className="text-center py-24">
        <h2 className="text-xl text-ink mb-2">Market not found</h2>
        <Link to="/markets" className="text-brand-glow hover:text-brand text-sm">
          ← Back to Markets
        </Link>
      </div>
    );
  }

  const bids = orderbook?.bids ?? [];
  const asks = orderbook?.asks ?? [];

  // Derive indicators from API response
  const rsiVal = market.rsi ?? 50;
  const indicators = market.indicators as Record<string, number | null> | undefined;

  return (
    <div className="space-y-5">
      <Link
        to="/markets"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        Markets
        <ChevronRight className="h-3 w-3 text-ink-subtle" />
        <span className="text-ink">{market.symbol}</span>
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-full bg-bg-card border border-border grid place-items-center text-xs font-bold text-ink">
              {market.base.slice(0, 3)}
            </span>
            <span>{market.symbol}</span>
            <span className="text-base font-normal text-ink-muted">{market.name}</span>
          </span>
        }
      />

      {/* Price banner */}
      <Card>
        <CardContent className="!p-5">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <div className="stat-label">Last Price</div>
              <div className="text-3xl font-bold text-ink num mt-1">
                {formatUSD(market.price)}
              </div>
              <div className={cn("text-xs num font-medium mt-1", pctClass(market.change24h))}>
                {formatPct(market.change24h)} 24h
              </div>
            </div>
            <Stat label="24h Volume" value={formatUSD(market.volume24h, { compact: true })} />
            <Stat
              label="Market Cap"
              value={market.marketCap ? formatUSD(market.marketCap, { compact: true }) : "—"}
            />
            <Stat
              label="RSI(14)"
              value={rsiVal.toFixed(1)}
              valueClass={rsiVal < 30 ? "text-bull" : rsiVal > 70 ? "text-bear" : "text-ink"}
            />
            <div>
              <div className="stat-label">EMA Bias</div>
              <div className="mt-2">
                <Badge
                  tone={
                    market.emaTrend === "long"
                      ? "bull"
                      : market.emaTrend === "short"
                        ? "bear"
                        : "neutral"
                  }
                  dot
                >
                  {market.emaTrend.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart + order book */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader>
            <CardTitle>Price · Last 7 days (1h)</CardTitle>
            <div className="flex items-center gap-1 bg-bg-subtle rounded-lg p-0.5 border border-border">
              {TIMEFRAMES.map((tf, i) => (
                <button
                  key={tf}
                  className={cn(
                    "px-2.5 h-7 text-xs font-medium rounded-md transition-colors num",
                    i === 3
                      ? "bg-bg-card text-ink shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="!p-0 !pb-3">
            <PriceChart data={market.series} height={380} />
          </CardContent>
          <div className="flex flex-wrap gap-2 px-5 pb-4 pt-1">
            {[
              { label: "RSI(14)", val: rsiVal.toFixed(1) },
              { label: "EMA Bias", val: market.emaTrend },
              ...(indicators
                ? Object.entries(indicators)
                    .filter(([, v]) => v !== null && v !== undefined)
                    .slice(0, 4)
                    .map(([k, v]) => ({ label: k, val: String(v) }))
                : []),
            ].map((ind) => (
              <div
                key={ind.label}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-subtle border border-border text-xs"
              >
                <span className="text-ink-muted">{ind.label}</span>
                <span className="text-ink font-medium num">{ind.val}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Order book */}
        <Card>
          <CardHeader>
            <CardTitle>Order Book</CardTitle>
            <Badge tone="neutral">Live</Badge>
          </CardHeader>
          <CardContent className="!p-0">
            <div className="grid grid-cols-3 gap-2 px-5 py-2 text-2xs uppercase tracking-wider text-ink-muted border-b border-border">
              <span>Price</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Total</span>
            </div>
            <div className="text-2xs">
              {asks.length === 0 && bids.length === 0 ? (
                <div className="py-6 text-center text-ink-muted text-xs">
                  Loading order book…
                </div>
              ) : (
                <>
                  {[...asks].reverse().slice(0, 8).map((row, i) => (
                    <OBRow key={`a-${i}`} side="ask" price={row[0]} qty={row[1]} />
                  ))}
                  <div className="px-5 py-2 border-y border-border bg-bg-subtle/40 flex items-center justify-between">
                    <span className="text-bull num font-bold text-base">
                      {formatUSD(market.price)}
                    </span>
                    <span className="text-2xs text-ink-muted">mid</span>
                  </div>
                  {bids.slice(0, 8).map((row, i) => (
                    <OBRow key={`b-${i}`} side="bid" price={row[0]} qty={row[1]} />
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent paper trades on this market */}
      <Card>
        <CardHeader>
          <CardTitle>Paper Trades · {market.symbol}</CardTitle>
          <Badge tone="neutral">Strategy activity</Badge>
        </CardHeader>
        <CardContent className="!p-0">
          {recentTrades.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-muted">
              No paper trades on this pair yet.
            </div>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Time</TH>
                  <TH>Strategy</TH>
                  <TH>Side</TH>
                  <TH className="text-right">Qty</TH>
                  <TH className="text-right">Price</TH>
                  <TH className="text-right">Realized P&L</TH>
                  <TH>Note</TH>
                </TR>
              </THead>
              <TBody>
                {recentTrades.map((t) => (
                  <TR key={t.id}>
                    <TD className="text-ink-muted text-xs">{formatRelativeTime(t.ts)}</TD>
                    <TD className="text-ink-muted text-xs">{t.strategyName}</TD>
                    <TD>
                      <Badge tone={t.side === "buy" ? "bull" : "bear"}>
                        {t.side.toUpperCase()}
                      </Badge>
                    </TD>
                    <TD className="text-right num text-ink">{t.qty.toFixed(4)}</TD>
                    <TD className="text-right num text-ink">{formatUSD(t.price)}</TD>
                    <TD className={cn("text-right num", pctClass(t.realizedPnl))}>
                      {t.realizedPnl ? formatUSD(t.realizedPnl, { decimals: 2 }) : "—"}
                    </TD>
                    <TD className="text-ink-muted text-xs italic">{t.note ?? "—"}</TD>
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

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className={cn("text-xl font-semibold text-ink num mt-1", valueClass)}>{value}</div>
    </div>
  );
}

function OBRow({ side, price, qty }: { side: "bid" | "ask"; price: number; qty: number }) {
  const total = price * qty;
  const maxQty = 10;
  const pct = Math.min(qty / maxQty, 1);
  return (
    <div className="relative px-5 py-1 grid grid-cols-3 gap-2 num text-2xs">
      <div
        className={cn(
          "absolute inset-y-0 right-0 pointer-events-none",
          side === "bid" ? "bg-bull-bg" : "bg-bear-bg",
        )}
        style={{ width: `${pct * 100}%` }}
      />
      <span className={cn("relative", side === "bid" ? "text-bull" : "text-bear")}>
        {price.toFixed(2)}
      </span>
      <span className="relative text-right text-ink">{qty.toFixed(3)}</span>
      <span className="relative text-right text-ink-muted">{total.toFixed(0)}</span>
    </div>
  );
}
