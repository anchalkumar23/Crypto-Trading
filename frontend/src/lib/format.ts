export function formatUSD(value: number, opts: { compact?: boolean; decimals?: number } = {}) {
  const { compact = false, decimals } = opts;
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits:
      decimals ?? (Math.abs(value) < 1 ? 4 : Math.abs(value) < 100 ? 2 : 2),
    minimumFractionDigits: decimals ?? (Math.abs(value) < 1 ? 4 : 2),
  });
  return fmt.format(value);
}

export function formatNumber(value: number, opts: { compact?: boolean; decimals?: number } = {}) {
  const { compact = false, decimals = 2 } = opts;
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatPct(value: number, opts: { decimals?: number; signed?: boolean } = {}) {
  const { decimals = 2, signed = true } = opts;
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diffSec = Math.round((now - ts) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

export function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function pctClass(value: number) {
  if (value > 0) return "text-bull";
  if (value < 0) return "text-bear";
  return "text-ink-muted";
}
