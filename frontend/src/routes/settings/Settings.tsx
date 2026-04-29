import { useState, useEffect } from "react";
import {
  KeyRound,
  Shield,
  Bell,
  Palette,
  TrendingUp,
  AlertTriangle,
  Plus,
  Trash2,
  Check,
  Loader2,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { settings as settingsApi } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const AVAILABLE_PAIRS = [
  "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT",
  "DOGE/USDT", "AVAX/USDT", "LINK/USDT", "MATIC/USDT", "ARB/USDT",
  "OP/USDT", "APT/USDT",
];

export function Settings() {
  const queryClient = useQueryClient();

  const { data: serverSettings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
  });

  const [watchedPairs, setWatchedPairs] = useState<string[]>([]);
  const [defaultTimeframe, setDefaultTimeframe] = useState("1h");
  const [liveTradingEnabled, setLiveTradingEnabled] = useState(false);
  const [notificationsEmail, setNotificationsEmail] = useState("");
  const [notificationsTelegram, setNotificationsTelegram] = useState("");
  const [newPair, setNewPair] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // API key form
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [keyForm, setKeyForm] = useState({
    exchange: "Binance",
    api_key: "",
    api_secret: "",
    scope: "read" as "read" | "trade",
  });
  const [keyError, setKeyError] = useState<string | null>(null);

  // Password confirmation for live trading
  const [liveConfirmPassword, setLiveConfirmPassword] = useState("");
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);

  // Sync local state when server data arrives
  useEffect(() => {
    if (!serverSettings) return;
    setWatchedPairs(serverSettings.watchedPairs ?? []);
    setDefaultTimeframe(serverSettings.defaultTimeframe ?? "1h");
    setLiveTradingEnabled(serverSettings.liveTradingEnabled ?? false);
    setNotificationsEmail(serverSettings.notificationsEmail ?? "");
    setNotificationsTelegram(serverSettings.notificationsTelegram ?? "");
  }, [serverSettings]);

  const updateMutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    },
  });

  const addKeyMutation = useMutation({
    mutationFn: settingsApi.addApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setShowKeyForm(false);
      setKeyForm({ exchange: "Binance", api_key: "", api_secret: "", scope: "read" });
      setKeyError(null);
    },
    onError: (err: Error) => setKeyError(err.message),
  });

  const deleteKeyMutation = useMutation({
    mutationFn: settingsApi.deleteApiKey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  function saveSettings() {
    updateMutation.mutate({
      watched_pairs: watchedPairs,
      default_timeframe: defaultTimeframe,
      notifications_email: notificationsEmail,
      notifications_telegram: notificationsTelegram,
    });
  }

  function toggleLiveTrading() {
    if (!liveTradingEnabled) {
      setShowLiveConfirm(true);
    } else {
      updateMutation.mutate({ live_trading_enabled: false });
      setLiveTradingEnabled(false);
    }
  }

  function confirmLiveTrading() {
    updateMutation.mutate({
      live_trading_enabled: true,
      password_confirmation: liveConfirmPassword,
    });
    setLiveTradingEnabled(true);
    setShowLiveConfirm(false);
    setLiveConfirmPassword("");
  }

  function addPair() {
    if (!newPair || watchedPairs.includes(newPair)) return;
    setWatchedPairs([...watchedPairs, newPair]);
    setNewPair("");
  }

  function removePair(symbol: string) {
    setWatchedPairs(watchedPairs.filter((p) => p !== symbol));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-ink-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading settings…</span>
      </div>
    );
  }

  const apiKeys = serverSettings?.apiKeys ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Account, exchange keys, watched pairs, notifications, and the live-trading kill switch."
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={saveSettings}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="h-4 w-4" />
            ) : null}
            {saveSuccess ? "Saved!" : "Save settings"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-glow" />
              <CardTitle>Watched Pairs</CardTitle>
            </div>
            <span className="text-2xs text-ink-muted num">{watchedPairs.length} pairs</span>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {watchedPairs.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-subtle pl-2.5 pr-1 py-1 text-sm font-medium text-ink"
                >
                  {p}
                  <button
                    onClick={() => removePair(p)}
                    className="h-5 w-5 rounded grid place-items-center text-ink-subtle hover:text-bear hover:bg-bear-bg transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <select
                value={newPair}
                onChange={(e) => setNewPair(e.target.value)}
                className="flex h-9 flex-1 rounded-lg border border-border bg-bg-subtle px-3 text-sm text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              >
                <option value="">Choose a pair to watch…</option>
                {AVAILABLE_PAIRS.filter((m) => !watchedPairs.includes(m)).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <Button variant="primary" onClick={addPair} disabled={!newPair}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-brand-glow" />
              <CardTitle>Appearance</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-2xs uppercase tracking-wider text-ink-muted mb-2">Theme</div>
              <div className="grid grid-cols-2 gap-2">
                <ThemeSwatch label="Dark" active />
                <ThemeSwatch label="Light" disabled />
              </div>
            </div>
            <div>
              <div className="text-2xs uppercase tracking-wider text-ink-muted mb-2">
                Default timeframe
              </div>
              <div className="flex items-center gap-1 bg-bg-subtle rounded-lg p-0.5 border border-border">
                {["15m", "1h", "4h", "1d"].map((tf) => (
                  <button
                    key={tf}
                    className={cn(
                      "flex-1 h-8 text-xs font-medium rounded-md transition-colors num",
                      tf === defaultTimeframe
                        ? "bg-bg-card text-ink shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
                        : "text-ink-muted hover:text-ink",
                    )}
                    onClick={() => setDefaultTimeframe(tf)}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live trading */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-warn" />
            <CardTitle>Live Trading</CardTitle>
          </div>
          <Badge tone={liveTradingEnabled ? "warn" : "info"} dot>
            {liveTradingEnabled ? "ENABLED" : "DISABLED"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-warn/30 bg-warn-bg p-4 mb-4 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-warn flex-shrink-0 mt-0.5" />
            <div className="text-xs text-ink-muted leading-relaxed">
              Live trading is OFF by default at the application level AND at each portfolio
              level. Both must be true to send a real order. Enabling requires re-typing your
              password and a Binance API key with{" "}
              <span className="text-ink font-medium">withdrawal disabled</span>.
            </div>
          </div>

          {showLiveConfirm ? (
            <div className="p-4 rounded-lg border border-warn/40 bg-warn-bg/60 space-y-3">
              <div className="text-sm font-medium text-ink">
                Confirm your password to enable live trading
              </div>
              <Input
                type="password"
                placeholder="Your password"
                value={liveConfirmPassword}
                onChange={(e) => setLiveConfirmPassword(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={confirmLiveTrading}
                  disabled={!liveConfirmPassword || updateMutation.isPending}
                >
                  Enable live trading
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowLiveConfirm(false);
                    setLiveConfirmPassword("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-bg-subtle/40">
              <div>
                <div className="text-sm font-medium text-ink">App-level live trading</div>
                <div className="text-2xs text-ink-muted mt-0.5">
                  Affects all portfolios. Requires password confirmation.
                </div>
              </div>
              <Toggle on={liveTradingEnabled} onChange={toggleLiveTrading} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <KillCard
              title="Kill switch"
              description="Halts all running strategies, cancels open orders (live), and locks live trading."
            />
            <KillCard
              title="Daily loss limit"
              description="Server-enforced. Trips → strategy_run.status = errored + notification."
            />
            <KillCard
              title="Audit log"
              description="Every order writes a row with strategy_run_id, params, decision, and resulting state."
            />
          </div>
        </CardContent>
      </Card>

      {/* API keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-brand-glow" />
            <CardTitle>Exchange API Keys</CardTitle>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowKeyForm(true)}>
            <Plus className="h-3 w-3" />
            Add key
          </Button>
        </CardHeader>
        <CardContent className="!p-0">
          {showKeyForm && (
            <div className="px-5 py-4 border-b border-border space-y-3">
              {keyError && (
                <div className="rounded-lg border border-bear/30 bg-bear-bg p-3 text-xs text-bear">
                  {keyError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1">
                    Exchange
                  </label>
                  <select
                    value={keyForm.exchange}
                    onChange={(e) => setKeyForm({ ...keyForm, exchange: e.target.value })}
                    className="flex h-9 w-full rounded-lg border border-border bg-bg-subtle px-3 text-sm text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  >
                    <option>Binance</option>
                  </select>
                </div>
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1">
                    Scope
                  </label>
                  <select
                    value={keyForm.scope}
                    onChange={(e) =>
                      setKeyForm({ ...keyForm, scope: e.target.value as "read" | "trade" })
                    }
                    className="flex h-9 w-full rounded-lg border border-border bg-bg-subtle px-3 text-sm text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  >
                    <option value="read">read (market data only)</option>
                    <option value="trade">trade (place orders)</option>
                  </select>
                </div>
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1">
                    API Key
                  </label>
                  <Input
                    type="password"
                    placeholder="Paste API key…"
                    value={keyForm.api_key}
                    onChange={(e) => setKeyForm({ ...keyForm, api_key: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1">
                    API Secret
                  </label>
                  <Input
                    type="password"
                    placeholder="Paste API secret…"
                    value={keyForm.api_secret}
                    onChange={(e) => setKeyForm({ ...keyForm, api_secret: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => addKeyMutation.mutate(keyForm)}
                  disabled={!keyForm.api_key || !keyForm.api_secret || addKeyMutation.isPending}
                >
                  {addKeyMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Save key
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowKeyForm(false);
                    setKeyError(null);
                  }}
                >
                  <X className="h-3 w-3" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {apiKeys.length === 0 && !showKeyForm ? (
            <div className="px-5 py-8 text-sm text-ink-muted text-center">
              No API keys added. Market data works without a key (public endpoints).
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {apiKeys.map((k) => (
                <li
                  key={k.id}
                  className="px-5 py-4 flex items-center justify-between hover:bg-bg-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-bg-hover border border-border grid place-items-center">
                      <KeyRound className="h-4 w-4 text-ink-muted" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-ink flex items-center gap-2">
                        {k.exchange}
                        <Badge tone={k.scope === "trade" ? "warn" : "info"}>{k.scope}</Badge>
                      </div>
                      <div className="text-2xs text-ink-muted num">
                        ••••{k.last_four} · added {formatRelativeTime(k.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="bull" dot>
                      <Check className="h-3 w-3" /> Stored
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteKeyMutation.mutate(k.id)}
                      disabled={deleteKeyMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-brand-glow" />
            <CardTitle>Notifications</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
              Email
            </label>
            <Input
              placeholder="alerts@example.com"
              value={notificationsEmail}
              onChange={(e) => setNotificationsEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
              Telegram chat ID
            </label>
            <Input
              placeholder="@you or numeric chat id"
              value={notificationsTelegram}
              onChange={(e) => setNotificationsTelegram(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <p className="text-2xs text-ink-muted">
              Notification delivery requires backend configuration (v2). Save your contact
              info above and it will be used when notifications are implemented.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ThemeSwatch({
  label,
  active,
  disabled,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={cn(
        "rounded-lg border p-2 transition-all",
        active
          ? "border-brand/60 bg-brand/8 shadow-[0_0_0_1px_rgba(124,92,255,0.30)]"
          : "border-border bg-bg-subtle hover:border-border-strong",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      <div className="h-8 rounded bg-gradient-to-br from-bg via-bg-card to-bg-subtle border border-border" />
      <div className="text-xs font-medium text-ink mt-1.5">
        {label} {disabled && <span className="text-ink-subtle">(soon)</span>}
      </div>
    </button>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={cn(
        "h-6 w-11 rounded-full transition-colors relative flex-shrink-0",
        on ? "bg-warn" : "bg-bg-hover border border-border",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function KillCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle/40 p-3">
      <div className="text-xs font-semibold text-ink">{title}</div>
      <div className="text-2xs text-ink-muted mt-1 leading-relaxed">{description}</div>
    </div>
  );
}
