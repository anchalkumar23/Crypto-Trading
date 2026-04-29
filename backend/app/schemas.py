"""Pydantic v2 DTOs for the API surface."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth ----------


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: "UserOut"


class UserOut(ORMBase):
    id: int
    email: str
    is_admin: bool
    created_at: datetime


class SetupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


# ---------- Markets ----------


class CryptoMarketOut(BaseModel):
    symbol: str
    base: str
    quote: str
    name: str
    price: float
    change24h: float
    volume24h: float
    marketCap: float | None = None
    rsi: float
    emaTrend: Literal["long", "neutral", "short"]
    sparkline: list[float]


class CryptoMarketDetailOut(CryptoMarketOut):
    indicators: dict[str, Any]
    series: list[dict[str, Any]]  # {t: epoch_ms, v: price}


class PolyOutcome(BaseModel):
    label: str
    price: float
    sharesTraded24h: float


class PolyMarketOut(BaseModel):
    id: str
    slug: str
    question: str
    category: str
    yes: float
    no: float
    volume24h: float
    liquidity: float
    endDate: int  # epoch ms
    outcomes: list[PolyOutcome]


# ---------- Portfolios ----------


class PositionOut(BaseModel):
    symbol: str
    qty: float
    avgPrice: float
    currentPrice: float
    unrealizedPnl: float
    unrealizedPct: float
    openedAt: int


class EquityCurvePoint(BaseModel):
    t: int
    v: float


class PortfolioOut(BaseModel):
    id: str
    name: str
    kind: Literal["paper", "live"]
    startingCash: float
    currentEquity: float
    cash: float
    positionsValue: float
    realizedPnl: float
    unrealizedPnl: float
    totalReturn: float
    winRate: float
    trades: int
    maxPositionPct: float
    maxOpenPositions: int
    dailyLossLimit: float
    feeRate: float
    slippageBps: float
    createdAt: int
    positions: list[PositionOut]
    equityCurve: list[EquityCurvePoint]
    strategyRunIds: list[str]


class PortfolioCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    starting_cash: float = Field(gt=0)
    fee_rate: float = 0.001
    slippage_bps: float = 5.0
    max_position_pct: float = 25.0
    max_open_positions: int = 4
    daily_loss_limit_usd: float = 200.0


class PortfolioUpdate(BaseModel):
    name: str | None = None
    fee_rate: float | None = None
    slippage_bps: float | None = None
    max_position_pct: float | None = None
    max_open_positions: int | None = None
    daily_loss_limit_usd: float | None = None


# ---------- Strategies ----------


class StrategyParam(BaseModel):
    key: str
    label: str
    value: float | int | str
    type: Literal["number", "string"] = "number"


class StrategyOut(BaseModel):
    id: str
    name: str
    displayName: str
    description: str
    category: str
    riskLevel: str
    params: list[StrategyParam]
    activeRuns: int
    ytdReturn: float
    sharpe: float


class StrategyRunOut(BaseModel):
    id: str
    strategyId: str
    strategyName: str
    portfolioId: str
    portfolioName: str
    status: str
    startedAt: int
    lastTickAt: int
    pnl: float
    trades: int


class StrategyRunCreate(BaseModel):
    strategy_id: int
    portfolio_id: int
    params: dict[str, Any] = Field(default_factory=dict)
    symbols: list[str] = Field(default_factory=lambda: ["BTCUSDT"])
    timeframe: str = "1h"


# ---------- Backtests ----------


class BacktestOut(BaseModel):
    id: str
    strategyName: str
    symbols: list[str]
    timeframe: str
    startDate: int
    endDate: int
    status: str
    totalReturn: float
    sharpe: float
    maxDrawdown: float
    trades: int
    winRate: float
    equityCurve: list[EquityCurvePoint]
    createdAt: int


class BacktestCreate(BaseModel):
    strategy_id: int
    symbols: list[str]
    timeframe: str = "1h"
    start_date: datetime
    end_date: datetime
    params: dict[str, Any] = Field(default_factory=dict)


# ---------- Trades ----------


class TradeOut(BaseModel):
    id: str
    portfolioId: str
    strategyName: str
    symbol: str
    side: Literal["buy", "sell"]
    qty: float
    price: float
    fee: float
    realizedPnl: float
    ts: int
    note: str | None = None


# ---------- Settings ----------


class ApiKeyIn(BaseModel):
    exchange: str
    api_key: str
    api_secret: str
    scope: Literal["read", "trade"] = "read"


class ApiKeyOut(BaseModel):
    id: int
    exchange: str
    scope: str
    last_four: str
    created_at: int


class SettingsOut(BaseModel):
    watchedPairs: list[str]
    defaultTimeframe: str
    liveTradingEnabled: bool
    notificationsEmail: str
    notificationsTelegram: str
    apiKeys: list[ApiKeyOut]


class SettingsUpdate(BaseModel):
    watched_pairs: list[str] | None = None
    default_timeframe: str | None = None
    live_trading_enabled: bool | None = None
    notifications_email: str | None = None
    notifications_telegram: str | None = None
    password_confirmation: str | None = None
