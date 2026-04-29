"""Technical indicators — pure-Python, numpy-free for lighter installs.

Functions take/return list[float] and produce list[float | None] of the same length
where leading entries that can't be computed are None. This matches how downstream
strategies want to consume them.
"""

from __future__ import annotations

from collections import deque
from typing import Literal


def ema(values: list[float], period: int) -> list[float | None]:
    if period <= 0:
        return [None] * len(values)
    out: list[float | None] = [None] * len(values)
    if len(values) < period:
        return out
    alpha = 2.0 / (period + 1)
    seed = sum(values[:period]) / period
    out[period - 1] = seed
    prev = seed
    for i in range(period, len(values)):
        cur = alpha * values[i] + (1 - alpha) * prev
        out[i] = cur
        prev = cur
    return out


def rsi(values: list[float], period: int = 14) -> list[float | None]:
    """Wilder's RSI."""
    n = len(values)
    out: list[float | None] = [None] * n
    if n <= period:
        return out
    gains: list[float] = []
    losses: list[float] = []
    for i in range(1, period + 1):
        diff = values[i] - values[i - 1]
        gains.append(max(diff, 0.0))
        losses.append(max(-diff, 0.0))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    rs = avg_gain / avg_loss if avg_loss > 0 else float("inf")
    out[period] = 100 - 100 / (1 + rs) if avg_loss > 0 else 100.0
    for i in range(period + 1, n):
        diff = values[i] - values[i - 1]
        gain = max(diff, 0.0)
        loss = max(-diff, 0.0)
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        if avg_loss == 0:
            out[i] = 100.0
        else:
            rs = avg_gain / avg_loss
            out[i] = 100 - 100 / (1 + rs)
    return out


def macd(
    values: list[float], fast: int = 12, slow: int = 26, signal: int = 9
) -> dict[str, list[float | None]]:
    fast_e = ema(values, fast)
    slow_e = ema(values, slow)
    line: list[float | None] = []
    for f, s in zip(fast_e, slow_e):
        if f is None or s is None:
            line.append(None)
        else:
            line.append(f - s)
    # Signal line is EMA of the macd line where defined.
    defined = [v for v in line if v is not None]
    sig_calc = ema(defined, signal)
    sig: list[float | None] = []
    j = 0
    for v in line:
        if v is None:
            sig.append(None)
        else:
            sig.append(sig_calc[j])
            j += 1
    hist: list[float | None] = [
        (l - s) if (l is not None and s is not None) else None for l, s in zip(line, sig)
    ]
    return {"line": line, "signal": sig, "hist": hist}


def bollinger(
    values: list[float], period: int = 20, std_mult: float = 2.0
) -> dict[str, list[float | None]]:
    n = len(values)
    upper: list[float | None] = [None] * n
    middle: list[float | None] = [None] * n
    lower: list[float | None] = [None] * n
    if n < period:
        return {"upper": upper, "middle": middle, "lower": lower}
    window: deque[float] = deque(maxlen=period)
    for i, v in enumerate(values):
        window.append(v)
        if i + 1 < period:
            continue
        mean = sum(window) / period
        var = sum((x - mean) ** 2 for x in window) / period
        sd = var**0.5
        middle[i] = mean
        upper[i] = mean + std_mult * sd
        lower[i] = mean - std_mult * sd
    return {"upper": upper, "middle": middle, "lower": lower}


Bias = Literal["long", "neutral", "short"]


def ema_trend_bias(values: list[float], short_p: int = 50, long_p: int = 200) -> Bias:
    """Simple bias: long if EMA50 > EMA200, short if reverse, neutral if undefined."""
    s = ema(values, short_p)[-1]
    l = ema(values, long_p)[-1]
    if s is None or l is None:
        return "neutral"
    diff = (s - l) / l if l else 0
    if diff > 0.005:
        return "long"
    if diff < -0.005:
        return "short"
    return "neutral"
