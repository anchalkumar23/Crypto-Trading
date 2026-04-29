import { useState } from "react";
import { Plus, History, GitCompare, Calendar, Clock, X, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { EquityChart } from "@/components/charts/EquityChart";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { backtests as backtestsApi, strategies as strategiesApi } from "@/lib/api";
import type { BacktestDTO } from "@/lib/api";
import { formatDate, formatPct, formatRelativeTime, pctClass } from "@/lib/format";
import { cn } from "@/lib/utils";

const TIMEFRAMES = ["15m", "1h", "4h", "1d"] as const;

// 30 days ago and yesterday as ISO strings
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export function Backtests() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<number[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    strategy_id: "",
    symbols: "BTCUSDT",
    timeframe: "1h" as (typeof TIMEFRAMES)[number],
    start_date: daysAgo(90),
    end_date: daysAgo(1),
  });

  const { data: btList = [], isLoading } = useQuery({
    queryKey: ["backtests"],
    queryFn: backtestsApi.list,
    refetchInterval: 10_000,
  });

  const { data: stratList = [] } = useQuery({
    queryKey: ["strategies"],
    queryFn: strategiesApi.list,
  });

  const createMutation = useMutation({
    mutationFn: backtestsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backtests"] });
      setShowForm(false);
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  function toggle(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-2),
    );
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.strategy_id) {
      setFormError("Select a strategy.");
      return;
    }
    const symbols = form.symbols
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (symbols.length === 0) {
      setFormError("Enter at least one symbol.");
      return;
    }
    const strat = stratList.find((s) => String(s.id) === form.strategy_id);
    const params: Record<string, unknown> = {};
    strat?.params.forEach((p) => {
      params[p.key] = p.type === "number" ? Number(p.value) : p.value;
    });
    createMutation.mutate({
      strategy_id: Number(form.strategy_id),
      symbols,
      timeframe: form.timeframe,
      start_date: form.start_date,
      end_date: form.end_date,
      params,
    });
  }

  const completedBts = btList.filter((b) => b.status === "complete");
  const selectedBts = btList.filter((b) => selected.includes(b.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backtests"
        subtitle="Queue strategy + parameter set + symbol set + timeframe over historical OHLCV. Compare two runs side-by-side."
        actions={
          <Button variant="primary" size="md" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            New backtest
          </Button>
        }
      />

      {/* New backtest form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Backtest</CardTitle>
            <button
              onClick={() => {
                setShowForm(false);
                setFormError(null);
              }}
              className="text-ink-muted hover:text-ink transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              {formError && (
                <div className="rounded-lg border border-bear/30 bg-bear-bg p-3 text-xs text-bear">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                    Strategy *
                  </label>
                  <select
                    value={form.strategy_id}
                    onChange={(e) => setForm({ ...form, strategy_id: e.target.value })}
                    className="flex h-9 w-full rounded-lg border border-border bg-bg-subtle px-3 text-sm text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  >
                    <option value="">Select a strategy…</option>
                    {stratList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                    Timeframe
                  </label>
                  <select
                    value={form.timeframe}
                    onChange={(e) =>
                      setForm({ ...form, timeframe: e.target.value as (typeof TIMEFRAMES)[number] })
                    }
                    className="flex h-9 w-full rounded-lg border border-border bg-bg-subtle px-3 text-sm text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  >
                    {TIMEFRAMES.map((tf) => (
                      <option key={tf} value={tf}>
                        {tf}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                    Symbols (comma-separated)
                  </label>
                  <Input
                    value={form.symbols}
                    onChange={(e) => setForm({ ...form, symbols: e.target.value })}
                    placeholder="BTCUSDT,ETHUSDT"
                  />
                </div>
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                    End Date
                  </label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" variant="primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Queuing…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Queue backtest
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    setFormError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Comparison chart */}
      {selectedBts.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Comparison</CardTitle>
              <p className="text-2xs text-ink-muted mt-0.5 uppercase tracking-wider">
                Equity curves overlaid
              </p>
            </div>
            <Badge tone="brand" dot>
              <GitCompare className="h-3 w-3" />
              {selectedBts.length} selected
            </Badge>
          </CardHeader>
          <CardContent className="!p-0 !pb-3">
            <ComparisonChart runs={selectedBts} />
          </CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-5 pb-5 border-t border-border pt-4">
            {selectedBts.map((b, i) => (
              <div key={b.id} className="rounded-lg border border-border bg-bg-subtle/40 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ background: i === 0 ? "#7c5cff" : "#22d3ee" }}
                    />
                    <div className="text-sm font-semibold text-ink truncate">
                      {b.strategyName}
                    </div>
                  </div>
                  <Badge tone={b.totalReturn >= 0 ? "bull" : "bear"}>
                    {formatPct(b.totalReturn)}
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-2 text-2xs num">
                  <Metric label="Sharpe" value={b.sharpe.toFixed(2)} />
                  <Metric
                    label="Max DD"
                    value={formatPct(b.maxDrawdown, { signed: false })}
                    valueClass="text-bear"
                  />
                  <Metric label="Trades" value={b.trades.toString()} />
                  <Metric label="Win" value={`${b.winRate.toFixed(0)}%`} />
                </div>
                <div className="text-2xs text-ink-muted mt-2 truncate">
                  {b.symbols.join(", ")} · {b.timeframe}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Run list */}
      <Card>
        <CardHeader>
          <CardTitle>All Runs</CardTitle>
          <span className="text-2xs text-ink-muted">
            Select up to 2 complete runs for side-by-side comparison
          </span>
        </CardHeader>
        <CardContent className="!p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : btList.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-muted">
              No backtests yet. Click{" "}
              <button
                onClick={() => setShowForm(true)}
                className="text-brand-glow hover:text-brand"
              >
                New backtest
              </button>{" "}
              to queue one.
            </div>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="w-8" />
                  <TH>Strategy</TH>
                  <TH>Symbols</TH>
                  <TH>Period</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Return</TH>
                  <TH className="text-right">Sharpe</TH>
                  <TH className="text-right">Max DD</TH>
                  <TH className="text-right">Trades</TH>
                  <TH className="text-right">Created</TH>
                </TR>
              </THead>
              <TBody>
                {btList.map((b) => (
                  <TR key={b.id}>
                    <TD className="!pr-0">
                      <input
                        type="checkbox"
                        checked={selected.includes(b.id)}
                        onChange={() => toggle(b.id)}
                        disabled={b.status !== "complete"}
                        className="accent-brand"
                      />
                    </TD>
                    <TD>
                      <div className="text-sm font-medium text-ink">{b.strategyName}</div>
                      <div className="text-2xs text-ink-muted num">{b.timeframe}</div>
                    </TD>
                    <TD className="text-xs text-ink-muted">
                      <span className="truncate inline-block max-w-[180px]">
                        {b.symbols.join(", ")}
                      </span>
                    </TD>
                    <TD className="text-2xs text-ink-muted num">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(b.startDate)} – {formatDate(b.endDate)}
                      </span>
                    </TD>
                    <TD>
                      <Badge
                        tone={
                          b.status === "complete"
                            ? "bull"
                            : b.status === "running"
                              ? "info"
                              : b.status === "queued"
                                ? "warn"
                                : "bear"
                        }
                        dot
                      >
                        {b.status}
                      </Badge>
                    </TD>
                    <TD
                      className={cn(
                        "text-right num font-semibold",
                        b.status === "complete" ? pctClass(b.totalReturn) : "text-ink-subtle",
                      )}
                    >
                      {b.status === "complete" ? formatPct(b.totalReturn) : "—"}
                    </TD>
                    <TD className="text-right num text-ink">
                      {b.status === "complete" ? b.sharpe.toFixed(2) : "—"}
                    </TD>
                    <TD className="text-right num text-bear">
                      {b.status === "complete"
                        ? formatPct(b.maxDrawdown, { signed: false })
                        : "—"}
                    </TD>
                    <TD className="text-right num text-ink">
                      {b.status === "complete" ? b.trades : "—"}
                    </TD>
                    <TD className="text-right text-2xs text-ink-muted num">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(b.createdAt)}
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tips</CardTitle>
          <History className="h-4 w-4 text-ink-subtle" />
        </CardHeader>
        <CardContent>
          <ul className="text-xs text-ink-muted space-y-2 leading-relaxed list-disc list-inside">
            <li>
              Backtests run in the background via FastAPI BackgroundTasks. The page
              auto-refreshes every 10s — in-progress runs will update automatically.
            </li>
            <li>
              Comparison normalizes equity curves to the same starting value so runs with
              different initial capital are directly comparable.
            </li>
            <li>
              Always reserve the most recent ~20% of data as a true holdout before going live.
              In-sample performance overstates out-of-sample results.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
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
      <div className="text-ink-muted uppercase tracking-wider">{label}</div>
      <div className={cn("text-ink font-medium mt-0.5", valueClass)}>{value}</div>
    </div>
  );
}

function ComparisonChart({ runs }: { runs: BacktestDTO[] }) {
  const normalized = runs.map((r) => {
    const start = r.equityCurve[0]?.v ?? 1;
    return r.equityCurve.map((p) => ({ t: p.t, v: (p.v / start) * 100 }));
  });
  if (normalized.length === 0 || (normalized[0]?.length ?? 0) === 0) {
    return <div className="py-12 text-center text-ink-muted text-sm">No data.</div>;
  }
  const primary = normalized[0];
  const secondary = normalized[1];
  const merged = primary.map((p, i) => ({
    t: p.t,
    v: p.v,
    benchmark: secondary?.[i]?.v,
  }));
  return (
    <div style={{ height: 320, width: "100%" }} className="px-3">
      <EquityChart
        data={merged.map((d) => ({ t: d.t, v: d.v }))}
        benchmark={merged.map((d) => ({ t: d.t, v: d.benchmark ?? 100 }))}
        color="#7c5cff"
        height={320}
      />
    </div>
  );
}

