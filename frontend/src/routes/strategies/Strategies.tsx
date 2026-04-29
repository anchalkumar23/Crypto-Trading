import { useState } from "react";
import { Beaker, Play, Pause, Square, Plus, X, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { strategies as strategiesApi, portfolios as portfolioApi } from "@/lib/api";
import type { StrategyDTO, StrategyParam } from "@/lib/api";
import { formatPct, formatRelativeTime, formatUSD, pctClass } from "@/lib/format";
import { cn } from "@/lib/utils";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

const DEFAULT_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "DOGEUSDT", "AVAXUSDT", "LINKUSDT", "MATICUSDT", "ARBUSDT",
];

export function Strategies() {
  const queryClient = useQueryClient();
  const [startingStrategy, setStartingStrategy] = useState<StrategyDTO | null>(null);
  const [runForm, setRunForm] = useState<{
    portfolio_id: string;
    symbols: string;
    timeframe: string;
    params: Record<string, string>;
  }>({ portfolio_id: "", symbols: "BTCUSDT", timeframe: "1h", params: {} });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: stratList = [], isLoading: loadingStrats } = useQuery({
    queryKey: ["strategies"],
    queryFn: strategiesApi.list,
    refetchInterval: 60_000,
  });

  const { data: runs = [], isLoading: loadingRuns } = useQuery({
    queryKey: ["strategies", "runs"],
    queryFn: strategiesApi.listRuns,
    refetchInterval: 15_000,
  });

  const { data: portList = [] } = useQuery({
    queryKey: ["portfolios"],
    queryFn: portfolioApi.list,
  });

  const pauseMutation = useMutation({
    mutationFn: strategiesApi.pauseRun,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["strategies", "runs"] }),
  });

  const resumeMutation = useMutation({
    mutationFn: strategiesApi.resumeRun,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["strategies", "runs"] }),
  });

  const stopMutation = useMutation({
    mutationFn: strategiesApi.stopRun,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["strategies", "runs"] }),
  });

  const startMutation = useMutation({
    mutationFn: strategiesApi.startRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies", "runs"] });
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      setStartingStrategy(null);
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  function openStartForm(strategy: StrategyDTO) {
    const defaultParams: Record<string, string> = {};
    strategy.params.forEach((p: StrategyParam) => {
      defaultParams[p.key] = String(p.value);
    });
    setRunForm({
      portfolio_id: portList[0] ? String(portList[0].id) : "",
      symbols: DEFAULT_SYMBOLS.slice(0, 2).join(","),
      timeframe: "1h",
      params: defaultParams,
    });
    setFormError(null);
    setStartingStrategy(strategy);
  }

  function handleStartRun(e: React.FormEvent) {
    e.preventDefault();
    if (!startingStrategy) return;
    if (!runForm.portfolio_id) {
      setFormError("Select a portfolio.");
      return;
    }
    const symbols = runForm.symbols
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (symbols.length === 0) {
      setFormError("Enter at least one symbol (e.g. BTCUSDT).");
      return;
    }
    const params: Record<string, unknown> = {};
    startingStrategy.params.forEach((p: StrategyParam) => {
      const raw = runForm.params[p.key] ?? String(p.value);
      params[p.key] = p.type === "number" ? Number(raw) : raw;
    });
    startMutation.mutate({
      strategy_id: Number(startingStrategy.id),
      portfolio_id: Number(runForm.portfolio_id),
      params,
      symbols,
      timeframe: runForm.timeframe,
    });
  }

  const activeRuns = runs.filter((r) => r.status === "running").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Strategies"
        subtitle="Strategies are Python classes registered server-side. Each declares a pydantic schema for its parameters."
        actions={
          <Badge tone="brand" dot>
            {activeRuns} running
          </Badge>
        }
      />

      {/* Start run modal */}
      {startingStrategy && (
        <Card>
          <CardHeader>
            <CardTitle>Start Run — {startingStrategy.displayName}</CardTitle>
            <button
              onClick={() => {
                setStartingStrategy(null);
                setFormError(null);
              }}
              className="text-ink-muted hover:text-ink transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStartRun} className="space-y-4">
              {formError && (
                <div className="rounded-lg border border-bear/30 bg-bear-bg p-3 text-xs text-bear">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                    Portfolio *
                  </label>
                  <select
                    value={runForm.portfolio_id}
                    onChange={(e) => setRunForm({ ...runForm, portfolio_id: e.target.value })}
                    className="flex h-9 w-full rounded-lg border border-border bg-bg-subtle px-3 text-sm text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  >
                    <option value="">Select a portfolio…</option>
                    {portList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                    Timeframe
                  </label>
                  <select
                    value={runForm.timeframe}
                    onChange={(e) => setRunForm({ ...runForm, timeframe: e.target.value })}
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
                    Symbols (comma-separated, e.g. BTCUSDT,ETHUSDT)
                  </label>
                  <Input
                    value={runForm.symbols}
                    onChange={(e) => setRunForm({ ...runForm, symbols: e.target.value })}
                    placeholder="BTCUSDT,ETHUSDT"
                  />
                </div>
                {startingStrategy.params.map((p: StrategyParam) => (
                  <div key={p.key}>
                    <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                      {p.label}
                    </label>
                    <Input
                      type={p.type === "number" ? "number" : "text"}
                      value={runForm.params[p.key] ?? String(p.value)}
                      onChange={(e) =>
                        setRunForm({
                          ...runForm,
                          params: { ...runForm.params, [p.key]: e.target.value },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" variant="primary" disabled={startMutation.isPending}>
                  {startMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Start run
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setStartingStrategy(null);
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

      {/* Strategy registry cards */}
      {loadingStrats ? (
        <div className="flex items-center justify-center py-12 gap-2 text-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading strategies…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {stratList.map((s) => (
            <Card key={s.id} className="card-hover overflow-hidden flex flex-col">
              <CardContent className="!p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-bg-hover border border-border grid place-items-center">
                      <Beaker className="h-4 w-4 text-brand-glow" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink truncate">
                        {s.displayName}
                      </div>
                      <div className="text-2xs text-ink-muted uppercase tracking-wider mt-0.5">
                        {s.category}
                      </div>
                    </div>
                  </div>
                  <Badge
                    tone={
                      s.riskLevel === "high"
                        ? "bear"
                        : s.riskLevel === "medium"
                          ? "warn"
                          : "info"
                    }
                  >
                    {s.riskLevel} risk
                  </Badge>
                </div>

                <p className="text-xs text-ink-muted leading-relaxed mb-4 flex-1">
                  {s.description}
                </p>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border mb-3">
                  <Stat label="Active runs" value={s.activeRuns.toString()} />
                  <Stat label="Category" value={s.category} />
                </div>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {s.params.slice(0, 4).map((p: StrategyParam) => (
                    <span
                      key={p.key}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-subtle border border-border text-2xs"
                    >
                      <span className="text-ink-muted">{p.label}</span>
                      <span className="text-ink font-medium num">{String(p.value)}</span>
                    </span>
                  ))}
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => openStartForm(s)}
                  disabled={portList.length === 0}
                  title={portList.length === 0 ? "Create a portfolio first" : undefined}
                >
                  <Play className="h-3 w-3" />
                  Run on portfolio
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Active runs table */}
      <Card>
        <CardHeader>
          <CardTitle>Strategy Runs</CardTitle>
          <Badge tone="brand" dot>
            {activeRuns} running
          </Badge>
        </CardHeader>
        <CardContent className="!p-0">
          {loadingRuns ? (
            <div className="flex items-center justify-center py-8 gap-2 text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : runs.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-muted">
              No strategy runs yet. Click <span className="text-brand-glow">Run on portfolio</span>{" "}
              above to start one.
            </div>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Strategy</TH>
                  <TH>Portfolio</TH>
                  <TH>Status</TH>
                  <TH>Last Tick</TH>
                  <TH className="text-right">Trades</TH>
                  <TH className="text-right">P&L</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {runs.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <div className="text-sm font-medium text-ink">{r.strategyName}</div>
                      <div className="text-2xs text-ink-muted">
                        Started {formatRelativeTime(r.startedAt)}
                      </div>
                    </TD>
                    <TD className="text-ink-muted">{r.portfolioName}</TD>
                    <TD>
                      <Badge
                        tone={
                          r.status === "running"
                            ? "bull"
                            : r.status === "paused"
                              ? "warn"
                              : r.status === "errored"
                                ? "bear"
                                : "neutral"
                        }
                        dot
                      >
                        {r.status}
                      </Badge>
                    </TD>
                    <TD className="text-2xs text-ink-muted num">
                      {r.lastTickAt ? formatRelativeTime(r.lastTickAt) : "—"}
                    </TD>
                    <TD className="text-right num text-ink">{r.trades}</TD>
                    <TD className={cn("text-right num font-semibold", pctClass(r.pnl))}>
                      {formatUSD(r.pnl, { decimals: 2 })}
                    </TD>
                    <TD className="text-right">
                      <div className="inline-flex items-center gap-1">
                        {r.status === "running" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Pause"
                            onClick={() => pauseMutation.mutate(r.id)}
                            disabled={pauseMutation.isPending}
                          >
                            <Pause className="h-3.5 w-3.5" />
                          </Button>
                        ) : r.status === "paused" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Resume"
                            onClick={() => resumeMutation.mutate(r.id)}
                            disabled={resumeMutation.isPending}
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {(r.status === "running" || r.status === "paused") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Stop"
                            onClick={() => stopMutation.mutate(r.id)}
                            disabled={stopMutation.isPending}
                          >
                            <Square className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="text-sm text-ink num font-medium mt-0.5">{value}</div>
    </div>
  );
}
