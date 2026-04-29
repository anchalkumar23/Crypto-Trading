"""Strategy registry — name -> class lookup, parameter descriptors for the UI."""

from __future__ import annotations

from typing import Any

from .base import ParamDescriptor, Strategy
from .ema_cross import EmaCross
from .rsi_meanrev import RsiMeanReversion

REGISTRY: dict[str, type[Strategy]] = {
    RsiMeanReversion.name: RsiMeanReversion,
    EmaCross.name: EmaCross,
}


def list_strategies() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for cls in REGISTRY.values():
        descriptors = (
            cls.descriptors()  # type: ignore[attr-defined]
            if hasattr(cls, "descriptors")
            else []
        )
        out.append(
            {
                "name": cls.name,
                "display_name": cls.display_name,
                "description": cls.description,
                "category": cls.category,
                "risk_level": cls.risk_level,
                "params_schema": cls.Params.model_json_schema(),
                "params": [
                    d.to_dict() if isinstance(d, ParamDescriptor) else d for d in descriptors
                ],
                "code_ref": f"{cls.__module__}:{cls.__name__}",
            }
        )
    return out


def get_strategy_class(name: str) -> type[Strategy] | None:
    return REGISTRY.get(name)
