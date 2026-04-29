"""EMA Cross trend-following strategy."""

from __future__ import annotations

from pydantic import BaseModel, Field

from ..indicators import ema
from .base import Decision, ParamDescriptor, Strategy


class EmaCrossParams(BaseModel):
    fast: int = Field(default=12, ge=2, le=200)
    slow: int = Field(default=26, ge=3, le=400)
    qty_pct: float = Field(default=0.10, ge=0.01, le=1.0)


class EmaCross(Strategy):
    name = "ema_cross"
    display_name = "EMA Cross"
    description = (
        "Goes long when fast EMA crosses above slow EMA, exits on the reverse cross. "
        "Classic trend-following template."
    )
    category = "Trend Following"
    risk_level = "medium"
    Params = EmaCrossParams

    @staticmethod
    def descriptors() -> list[ParamDescriptor]:
        return [
            ParamDescriptor("fast", "Fast EMA", 12),
            ParamDescriptor("slow", "Slow EMA", 26),
            ParamDescriptor("qty_pct", "Position Size (0.01–1.0)", 0.10),
        ]

    def decide(self, symbol: str, prices: list[float], position_qty: float) -> Decision:
        p: EmaCrossParams = self.params  # type: ignore[assignment]
        if len(prices) < p.slow + 2:
            return Decision("hold", reason="not enough history")

        f = ema(prices, p.fast)
        s = ema(prices, p.slow)
        if f[-2] is None or s[-2] is None or f[-1] is None or s[-1] is None:
            return Decision("hold", reason="indicators not ready")

        crossed_up = f[-2] <= s[-2] and f[-1] > s[-1]
        crossed_dn = f[-2] >= s[-2] and f[-1] < s[-1]

        if crossed_up and position_qty <= 0:
            return Decision("buy", qty_pct=p.qty_pct, reason="EMA fast↑slow")
        if crossed_dn and position_qty > 0:
            return Decision("sell", qty_pct=1.0, reason="EMA fast↓slow")
        return Decision("hold", reason="no cross")
