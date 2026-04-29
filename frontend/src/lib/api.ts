const RAW_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
export const API_BASE = RAW_BASE || "http://localhost:8000";

const TOKEN_KEY = "vegalab_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string | null): void {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  { auth = true }: { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    // Expired or invalid token — clear it so the login page shows
    if (res.status === 401 && auth) {
      setToken(null);
      window.location.href = "/login";
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new ApiError(res.status, `${res.status} ${res.statusText}`, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------- Auth ----------

export interface User {
  id: number;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  user: User;
}

export const auth = {
  login: (email: string, password: string) =>
    request<TokenResponse>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      { auth: false },
    ),
  setup: (email: string, password: string) =>
    request<TokenResponse>(
      "/api/auth/setup",
      { method: "POST", body: JSON.stringify({ email, password }) },
      { auth: false },
    ),
  me: () => request<User>("/api/auth/me"),
};

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ---------- Markets ----------

export interface CryptoMarketRow {
  symbol: string;
  base: string;
  quote: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number | null;
  rsi: number;
  emaTrend: "long" | "neutral" | "short";
  sparkline: number[];
}

export interface CryptoMarketDetail extends CryptoMarketRow {
  indicators: Record<string, unknown>;
  series: { t: number; v: number }[];
}

export interface PolyMarketRow {
  id: string;
  slug: string;
  question: string;
  category: string;
  yes: number;
  no: number;
  volume24h: number;
  liquidity: number;
  endDate: number;
  outcomes: { label: string; price: number; sharesTraded24h: number }[];
}

// Strip display slash: "BTC/USDT" → "BTCUSDT" for backend URL (backend also accepts both)
function rawSym(symbol: string): string {
  return symbol.replace("/", "");
}

export const markets = {
  listCrypto: () =>
    request<{ data: CryptoMarketRow[] }>("/api/markets/crypto").then((r) => r.data),
  getCrypto: (symbol: string) =>
    request<CryptoMarketDetail>(`/api/markets/crypto/${rawSym(symbol)}`),
  orderbook: (symbol: string) =>
    request<{ bids: number[][]; asks: number[][] }>(
      `/api/markets/crypto/${rawSym(symbol)}/orderbook`,
    ),
  listPolymarket: () =>
    request<{ data: PolyMarketRow[] }>("/api/markets/polymarket").then((r) => r.data),
  getPolymarket: (slug: string) =>
    request<PolyMarketRow>(`/api/markets/polymarket/${encodeURIComponent(slug)}`),
};

// ---------- Portfolios ----------

export interface PositionDTO {
  symbol: string;
  qty: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPct: number;
  openedAt: number;
}

export interface PortfolioDTO {
  id: number;
  name: string;
  kind: "paper" | "live";
  startingCash: number;
  currentEquity: number;
  cash: number;
  positionsValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalReturn: number;
  winRate: number;
  trades: number;
  maxPositionPct: number;
  maxOpenPositions: number;
  dailyLossLimit: number;
  feeRate: number;
  slippageBps: number;
  createdAt: number;
  positions: PositionDTO[];
  equityCurve: { t: number; v: number }[];
  strategyRunIds: number[];
}

export interface PortfolioCreate {
  name: string;
  starting_cash: number;
  fee_rate?: number;
  slippage_bps?: number;
  max_position_pct?: number;
  max_open_positions?: number;
  daily_loss_limit_usd?: number;
}

export const portfolios = {
  list: () =>
    request<{ data: PortfolioDTO[] }>("/api/portfolios").then((r) => r.data),
  get: (id: number | string) => request<PortfolioDTO>(`/api/portfolios/${id}`),
  create: (data: PortfolioCreate) =>
    request<PortfolioDTO>("/api/portfolios", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (
    id: number | string,
    data: Partial<{
      name: string;
      max_position_pct: number;
      max_open_positions: number;
      daily_loss_limit_usd: number;
      fee_rate: number;
      slippage_bps: number;
    }>,
  ) =>
    request<PortfolioDTO>(`/api/portfolios/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  reset: (id: number | string) =>
    request<{ ok: boolean }>(`/api/portfolios/${id}/reset`, { method: "POST" }),
  archive: (id: number | string) =>
    request<void>(`/api/portfolios/${id}`, { method: "DELETE" }),
};

// ---------- Strategies ----------

export interface StrategyParam {
  key: string;
  label: string;
  value: number | string;
  type: string;
}

export interface StrategyDTO {
  id: number;
  name: string;
  displayName: string;
  description: string;
  category: string;
  riskLevel: string;
  params: StrategyParam[];
  activeRuns: number;
  ytdReturn: number;
  sharpe: number;
}

export interface StrategyRunDTO {
  id: number;
  strategyId: number;
  strategyName: string;
  portfolioId: number;
  portfolioName: string;
  status: "running" | "paused" | "stopped" | "errored";
  startedAt: number;
  lastTickAt: number;
  pnl: number;
  trades: number;
}

export const strategies = {
  list: () =>
    request<{ data: StrategyDTO[] }>("/api/strategies").then((r) => r.data),
  listRuns: () =>
    request<{ data: StrategyRunDTO[] }>("/api/strategies/runs").then((r) => r.data),
  startRun: (data: {
    strategy_id: number;
    portfolio_id: number;
    params: Record<string, unknown>;
    symbols: string[];
    timeframe: string;
  }) =>
    request<{ id: number; status: string }>("/api/strategies/runs", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  pauseRun: (id: number | string) =>
    request<{ id: number; status: string }>(`/api/strategies/runs/${id}/pause`, {
      method: "POST",
    }),
  resumeRun: (id: number | string) =>
    request<{ id: number; status: string }>(`/api/strategies/runs/${id}/resume`, {
      method: "POST",
    }),
  stopRun: (id: number | string) =>
    request<{ id: number; status: string }>(`/api/strategies/runs/${id}/stop`, {
      method: "POST",
    }),
};

// ---------- Backtests ----------

export interface BacktestDTO {
  id: number;
  strategyName: string;
  symbols: string[];
  timeframe: string;
  startDate: number;
  endDate: number;
  status: "queued" | "running" | "complete" | "failed";
  totalReturn: number;
  sharpe: number;
  maxDrawdown: number;
  trades: number;
  winRate: number;
  equityCurve: { t: number; v: number }[];
  createdAt: number;
}

export const backtests = {
  list: () =>
    request<{ data: BacktestDTO[] }>("/api/backtests").then((r) => r.data),
  create: (data: {
    strategy_id: number;
    symbols: string[];
    timeframe: string;
    start_date: string;
    end_date: string;
    params: Record<string, unknown>;
  }) =>
    request<{ id: number; status: string }>("/api/backtests", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ---------- Trades ----------

export interface TradeDTO {
  id: number;
  portfolioId: number;
  strategyName: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  fee: number;
  realizedPnl: number;
  ts: number;
  note: string | null;
}

export const trades = {
  list: (params: { portfolio_id?: number | string; symbol?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.portfolio_id !== undefined) q.set("portfolio_id", String(params.portfolio_id));
    if (params.symbol) q.set("symbol", params.symbol);
    if (params.limit) q.set("limit", String(params.limit));
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return request<{ data: TradeDTO[] }>(`/api/trades${suffix}`).then((r) => r.data);
  },
};

// ---------- Settings ----------

export interface SettingsDTO {
  watchedPairs: string[];
  defaultTimeframe: string;
  liveTradingEnabled: boolean;
  notificationsEmail: string;
  notificationsTelegram: string;
  apiKeys: {
    id: number;
    exchange: string;
    scope: string;
    last_four: string;
    created_at: number;
  }[];
}

export const settings = {
  get: () => request<SettingsDTO>("/api/settings"),
  update: (data: {
    watched_pairs?: string[];
    default_timeframe?: string;
    live_trading_enabled?: boolean;
    notifications_email?: string;
    notifications_telegram?: string;
    password_confirmation?: string;
  }) =>
    request<SettingsDTO>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  addApiKey: (data: {
    exchange: string;
    api_key: string;
    api_secret: string;
    scope: "read" | "trade";
  }) =>
    request<SettingsDTO["apiKeys"][number]>("/api/settings/api-keys", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteApiKey: (id: number) =>
    request<void>(`/api/settings/api-keys/${id}`, { method: "DELETE" }),
};

// ---------- Kill switch ----------

export const kill = {
  trigger: () => request<{ stopped: number }>("/api/kill", { method: "POST" }),
};

// ---------- WebSocket ----------

export type WsEvent =
  | { type: "hello"; data: unknown }
  | { type: "tick"; data: { ran_at: string; runs_processed: number; errors: number } }
  | { type: "trade"; data: { portfolio_id: number; symbol: string; side: string; qty: number; price: number } }
  | { type: "ack"; data: unknown };

export function openWebSocket(onMessage: (ev: WsEvent) => void): () => void {
  const url = API_BASE.replace(/^http/, "ws") + "/ws";
  const ws = new WebSocket(url);
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data) as WsEvent);
    } catch {
      // ignore non-JSON frames
    }
  };
  return () => {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  };
}
