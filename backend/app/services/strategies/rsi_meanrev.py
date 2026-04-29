"""RSI mean-reversion strategy.

Buys when RSI < oversold AND price > EMA(filter); sells when RSI > overbought.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from ..indicators import ema, rsi
from .base import Decision, ParamDescriptor, Strategy


class RsiParams(BaseModel):
    rsi_period: int = Field(default=14, ge=2, le=200)
    oversold: float = Field(default=30, ge=1, le=99)
    overbought: float = Field(default=70, ge=1, le=99)
    ema_filter: int = Field(default=200, ge=10, le=400)
    qty_pct: float = Field(default=0.10, ge=0.01, le=1.0)


class RsiMeanReversion(Strategy):
    name = "rsi_meanrev"
    display_name = "RSI Mean Reversion"
    description = (
        "Buys when RSI falls below an oversold threshold and price is above the EMA trend filter. "
        "Sells when RSI crosses back above the overbought threshold."
    )
    category = "Mean Reversion"
    risk_level = "medium"
    Params = RsiParams

    @staticmethod
    def descriptors() -> list[ParamDescriptor]:
        return [
            ParamDescriptor("rsi_period", "RSI Period", 14),
            ParamDescriptor("oversold", "Oversold", 30),
            ParamDescriptor("overbought", "Overbought", 70),
            ParamDescriptor("ema_filter", "EMA Filter", 200),
            ParamDescriptor("qty_pct", "Position Size (0.01–1.0)", 0.10),
        ]

    def decide(
        self, symbol: str, prices: list[float], position_qty: float
    ) -> Decision:
        p: RsiParams = self.params  # type: ignore[assignment]
        if len(prices) < max(p.rsi_period * 2, p.ema_filter):
            return Decision("hold", reason="not enough history")

        rsi_series = rsi(prices, p.rsi_period)
        ema_series = ema(prices, p.ema_filter)
        last_rsi = rsi_series[-1]
        last_ema = ema_series[-1]
        last_price = prices[-1]

        if last_rsi is None or last_ema is None:
            return Decision("hold", reason="indicators not ready")

        if position_qty <= 0 and last_rsi < p.oversold and last_price > last_ema:
            return Decision(
                "buy",
                qty_pct=p.qty_pct,
                reason=f"RSI={last_rsi:.1f} < {p.oversold}, price > EMA{p.ema_filter}",
            )

        if position_qty > 0 and last_rsi > p.overbought:
            return Decision(
                "sell",
                qty_pct=1.0,  # close full position
                reason=f"RSI={last_rsi:.1f} > {p.overbought}",
            )

        return Decision("hold", reason=f"RSI={last_rsi:.1f}")
