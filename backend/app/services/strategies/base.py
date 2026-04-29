"""Strategy abstraction. Each concrete strategy declares its params via pydantic."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, ClassVar, Literal

from pydantic import BaseModel


@dataclass
class Decision:
    action: Literal["buy", "sell", "hold"]
    qty_pct: float = 0.0  # fraction of available cash (or position) to use
    reason: str = ""


class Strategy:
    """Subclass me. The class itself is the registry entry."""

    name: ClassVar[str]
    display_name: ClassVar[str]
    description: ClassVar[str]
    category: ClassVar[str] = "Mean Reversion"
    risk_level: ClassVar[Literal["low", "medium", "high"]] = "medium"
    Params: ClassVar[type[BaseModel]]

    def __init__(self, params: dict[str, Any]) -> None:
        self.params = self.Params(**params)

    def decide(
        self,
        symbol: str,
        prices: list[float],
        position_qty: float,
    ) -> Decision:
        raise NotImplementedError


# UI-friendly param descriptor for the frontend forms (matches schemas.StrategyParam).
@dataclass
class ParamDescriptor:
    key: str
    label: str
    value: float | int | str
    type: Literal["number", "string"] = "number"

    def to_dict(self) -> dict[str, Any]:
        return {"key": self.key, "label": self.label, "value": self.value, "type": self.type}
