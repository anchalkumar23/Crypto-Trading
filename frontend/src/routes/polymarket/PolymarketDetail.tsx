import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ChevronRight, ExternalLink, Clock, Droplet, TrendingUp, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { markets } from "@/lib/api";
import { formatDate, formatUSD } from "@/lib/format";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

// Deterministic synthetic history based on slug + current yes probability
function makeProbHistory(slug: string, yesNow: number, points = 60) {
  let seed = slug.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
  function next() {
    seed = (seed * 1664525 + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  }
  const out: { t: number; yes: number }[] = [];
  const now = Date.now();
  let v = 0.5;
  for (let i = points; i >= 0; i--) {
    const drift = ((points - i) / points) * (yesNow - 0.5) * 0.8;
    v = Math.max(0.02, Math.min(0.98, 0.5 + drift + (next() - 0.5) * 0.06));
    out.push({ t: now - i * 86400000, yes: v });
  }
  out[out.length - 1].yes = yesNow;
  return out;
}

export function PolymarketDetail() {
  const { slug } = useParams<{ slug: string }>();

  const { data: market, isLoading, isError } = useQuery({
    queryKey: ["polymarket", slug],
    queryFn: () => markets.getPolymarket(slug!),
    enabled: !!slug,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-ink-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading market…</span>
      </div>
    );
  }

  if (isError || !market) {
    return (
      <div className="text-center py-24">
        <h2 className="text-xl text-ink mb-2">Market not found</h2>
        <Link to="/polymarket" className="text-brand-glow hover:text-brand text-sm">
          ← Back to Polymarket
        </Link>
      </div>
    );
  }

  const yesPct = Math.round(market.yes * 100);
  const daysLeft = Math.max(0, Math.round((market.endDate - Date.now()) / 86400000));
  const history = makeProbHistory(market.slug, market.yes);

  return (
    <div className="space-y-5">
      <Link
        to="/polymarket"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        Polymarket
        <ChevronRight className="h-3 w-3 text-ink-subtle" />
        <span className="text-ink truncate max-w-[300px]">{market.question}</span>
      </Link>

      <PageHeader
        title={market.question}
        subtitle={`Resolves ${formatDate(market.endDate)} · ${daysLeft} days remaining`}
        actions={
          <Button
            variant="secondary"
            size="md"
            onClick={() =>
              window.open(`https://polymarket.com/event/${market.slug}`, "_blank")
            }
          >
            <ExternalLink className="h-4 w-4" />
            View on Polymarket
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* YES/NO panel + chart */}
        <Card className="lg:col-span-2">
          <CardContent className="!p-6">
            <div className="flex items-center justify-between mb-4">
              <Badge tone="brand">{market.category}</Badge>
              <span className="text-2xs text-ink-muted uppercase tracking-wider">
                Current implied probability
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-xl border border-bull/30 bg-bull-bg p-5">
                <div className="text-2xs uppercase tracking-wider text-bull font-semibold">YES</div>
                <div className="text-4xl font-bold text-ink num mt-1">{yesPct}¢</div>
                <div className="text-xs text-ink-muted mt-1 num">
                  Implied {(market.yes * 100).toFixed(1)}%
                  {market.outcomes[0] && (
                    <> · Vol {formatUSD(market.outcomes[0].sharesTraded24h, { compact: true })}</>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-bear/30 bg-bear-bg p-5">
                <div className="text-2xs uppercase tracking-wider text-bear font-semibold">NO</div>
                <div className="text-4xl font-bold text-ink num mt-1">
                  {Math.round(market.no * 100)}¢
                </div>
                <div className="text-xs text-ink-muted mt-1 num">
                  Implied {(market.no * 100).toFixed(1)}%
                  {market.outcomes[1] && (
                    <> · Vol {formatUSD(market.outcomes[1].sharesTraded24h, { compact: true })}</>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <CardTitle>Probability over time</CardTitle>
                <span className="text-2xs text-ink-muted uppercase tracking-wider">
                  Last 60 days (estimated)
                </span>
              </div>
              <div style={{ height: 240, width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="probFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#7c5cff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1f2638" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="t"
                      tickFormatter={(t) =>
                        new Date(t).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                      stroke="#5a6378"
                      fontSize={11}
                      tickMargin={8}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={48}
                    />
                    <YAxis
                      stroke="#5a6378"
                      fontSize={11}
                      width={48}
                      domain={[0, 1]}
                      tickFormatter={(v) => `${Math.round(v * 100)}%`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as { t: number; yes: number };
                        return (
                          <div className="rounded-lg border border-border bg-bg-card px-3 py-2 shadow-lg">
                            <div className="text-2xs uppercase tracking-wider text-ink-muted">
                              {formatDate(p.t)}
                            </div>
                            <div className="text-sm font-semibold num text-ink mt-0.5">
                              YES {(p.yes * 100).toFixed(1)}%
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="yes"
                      stroke="#7c5cff"
                      strokeWidth={2}
                      fill="url(#probFill)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Side facts */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Market Facts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row icon={<TrendingUp className="h-4 w-4 text-ink-subtle" />} label="24h Volume">
                <span className="num">{formatUSD(market.volume24h)}</span>
              </Row>
              <Row icon={<Droplet className="h-4 w-4 text-ink-subtle" />} label="Liquidity">
                <span className="num">{formatUSD(market.liquidity)}</span>
              </Row>
              <Row icon={<Clock className="h-4 w-4 text-ink-subtle" />} label="Resolves">
                <span className="num">{formatDate(market.endDate)}</span>
              </Row>
              <Row label="Category">
                <Badge tone="brand">{market.category}</Badge>
              </Row>
            </CardContent>
          </Card>

          {market.outcomes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Outcomes</CardTitle>
                <Badge tone="warn">Read-only</Badge>
              </CardHeader>
              <CardContent className="!p-0">
                <ul className="divide-y divide-border">
                  {market.outcomes.map((o, i) => (
                    <li key={i} className="px-5 py-3 flex items-center justify-between text-sm">
                      <Badge tone={o.label === "Yes" ? "bull" : "bear"}>{o.label}</Badge>
                      <span className="num text-ink font-semibold">
                        {(o.price * 100).toFixed(1)}¢
                      </span>
                      <span className="num text-ink-muted text-xs">
                        {formatUSD(o.sharesTraded24h, { compact: true })} vol
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-muted inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="text-ink font-medium">{children}</span>
    </div>
  );
}
