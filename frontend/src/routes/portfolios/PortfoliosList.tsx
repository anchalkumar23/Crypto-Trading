import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Wallet, Loader2, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Sparkline } from "@/components/charts/Sparkline";
import { portfolios as portfolioApi } from "@/lib/api";
import { formatPct, formatUSD, pctClass } from "@/lib/format";
import { cn } from "@/lib/utils";

const DEFAULT_FORM = {
  name: "",
  starting_cash: 10000,
  fee_rate: 0.001,
  slippage_bps: 5,
  max_position_pct: 25,
  max_open_positions: 4,
  daily_loss_limit_usd: 200,
};

export function PortfoliosList() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);

  const { data: portList = [], isLoading } = useQuery({
    queryKey: ["portfolios"],
    queryFn: portfolioApi.list,
    refetchInterval: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: portfolioApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setShowCreate(false);
      setForm(DEFAULT_FORM);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Portfolio name is required.");
      return;
    }
    createMutation.mutate(form);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolios"
        subtitle="Each portfolio carries its own cash, positions, risk caps, and audit log. Paper portfolios cannot send real orders."
        actions={
          <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New portfolio
          </Button>
        }
      />

      {/* Create portfolio form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>New Paper Portfolio</CardTitle>
            <button
              onClick={() => {
                setShowCreate(false);
                setError(null);
              }}
              className="text-ink-muted hover:text-ink transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-bear/30 bg-bear-bg p-3 text-xs text-bear">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                    Portfolio Name *
                  </label>
                  <Input
                    placeholder="e.g. RSI Lab — BTC/ETH"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                    Starting Cash (USD)
                  </label>
                  <Input
                    type="number"
                    min={100}
                    value={form.starting_cash}
                    onChange={(e) =>
                      setForm({ ...form, starting_cash: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                    Daily Loss Limit (USD)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.daily_loss_limit_usd}
                    onChange={(e) =>
                      setForm({ ...form, daily_loss_limit_usd: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                    Max Position Size (%)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.max_position_pct}
                    onChange={(e) =>
                      setForm({ ...form, max_position_pct: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                    Max Open Positions
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={form.max_open_positions}
                    onChange={(e) =>
                      setForm({ ...form, max_open_positions: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                    Fee Rate (e.g. 0.001 = 0.1%)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.0001}
                    value={form.fee_rate}
                    onChange={(e) => setForm({ ...form, fee_rate: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                    Slippage (bps)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.slippage_bps}
                    onChange={(e) =>
                      setForm({ ...form, slippage_bps: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create portfolio
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowCreate(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading portfolios…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {portList.map((p) => (
            <Link
              key={p.id}
              to={`/portfolios/${p.id}`}
              className="card card-hover overflow-hidden group"
            >
              <CardContent className="!p-5">
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-brand-gradient grid place-items-center">
                      <Wallet className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink truncate group-hover:text-brand-glow transition-colors">
                        {p.name}
                      </div>
                      <div className="text-2xs text-ink-muted uppercase tracking-wider mt-0.5">
                        {p.kind} · {p.positions.length} positions
                      </div>
                    </div>
                  </div>
                  <Badge tone={p.totalReturn >= 0 ? "bull" : "bear"}>
                    {formatPct(p.totalReturn)}
                  </Badge>
                </div>

                <div className="text-3xl font-bold text-ink num">
                  {formatUSD(p.currentEquity)}
                </div>
                <div className={cn("text-xs num mt-1", pctClass(p.realizedPnl + p.unrealizedPnl))}>
                  {formatUSD(p.realizedPnl + p.unrealizedPnl, { decimals: 2 })} total P&L
                </div>

                {p.equityCurve.length > 0 && (
                  <div className="mt-4 mb-2">
                    <Sparkline data={p.equityCurve.map((c) => c.v)} height={56} />
                  </div>
                )}

                <div className="mt-3 grid grid-cols-3 gap-3 pt-3 border-t border-border">
                  <Stat label="Win rate" value={`${p.winRate.toFixed(1)}%`} />
                  <Stat label="Trades" value={p.trades.toString()} />
                  <Stat label="Cash" value={formatUSD(p.cash, { compact: true })} />
                </div>
              </CardContent>
            </Link>
          ))}

          {/* Add new card */}
          <button
            onClick={() => setShowCreate(true)}
            className="card border-dashed flex items-center justify-center min-h-[280px] hover:border-brand/40 hover:bg-bg-hover/50 transition-colors group cursor-pointer"
          >
            <div className="text-center p-6">
              <div className="h-10 w-10 rounded-lg bg-bg-hover grid place-items-center mx-auto mb-3 group-hover:bg-brand/10 transition-colors">
                <Plus className="h-5 w-5 text-ink-muted group-hover:text-brand-glow transition-colors" />
              </div>
              <div className="text-sm font-medium text-ink-muted group-hover:text-ink transition-colors">
                Create new paper portfolio
              </div>
              <div className="text-2xs text-ink-subtle mt-1">
                Set starting cash, fees, slippage, and risk caps
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="text-sm text-ink num font-medium mt-0.5">{value}</div>
    </div>
  );
}
