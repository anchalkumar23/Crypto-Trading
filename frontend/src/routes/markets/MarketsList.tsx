import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownUp, Loader2, Search, Star, WifiOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/charts/Sparkline";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { markets, type CryptoMarketRow } from "@/lib/api";
import { formatPct, formatUSD, pctClass } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "symbol" | "price" | "change24h" | "volume24h" | "marketCap" | "rsi";

export function MarketsList() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("volume24h");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState<"all" | "long" | "neutral" | "short">("all");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["markets", "crypto"],
    queryFn: markets.listCrypto,
    refetchInterval: 30_000,
  });

  const live: CryptoMarketRow[] = data ?? [];

  const filtered = useMemo(() => {
    let rows: CryptoMarketRow[] = live;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (m) =>
          m.symbol.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.base.toLowerCase().includes(q),
      );
    }
    if (filter !== "all") {
      rows = rows.filter((m) => m.emaTrend === filter);
    }
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = typeof av === "string" ? 0 : (av ?? 0);
      const bn = typeof bv === "string" ? 0 : (bv ?? 0);
      const cmp =
        typeof av === "string"
          ? (av as string).localeCompare(bv as string)
          : (an as number) - (bn as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [live, search, sortKey, sortDir, filter]);

  function setSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const SortableTH = ({ k, label, align }: { k: SortKey; label: string; align?: "right" }) => (
    <TH className={cn(align === "right" && "text-right")}>
      <button
        onClick={() => setSort(k)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-ink transition-colors",
          align === "right" && "ml-auto",
          sortKey === k && "text-ink",
        )}
      >
        {label}
        <ArrowDownUp className="h-2.5 w-2.5 opacity-60" />
      </button>
    </TH>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crypto Markets"
        subtitle="Live prices and indicators across configured pairs. Click any pair to dig in."
      />

      {isError && (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-warn/30 bg-warn-bg text-xs">
          <WifiOff className="h-4 w-4 text-warn mt-0.5 flex-shrink-0" />
          <div className="text-ink-muted leading-relaxed">
            <span className="text-ink font-medium">Backend unreachable.</span> Start the
            FastAPI server (port 8000) for live Binance prices.
          </div>
        </div>
      )}

      <Card>
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between p-4 border-b border-border">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search BTC, ETH, Solana…"
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-bg-subtle border border-border text-sm placeholder:text-ink-subtle focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>

          <div className="flex items-center gap-2">
            {isLoading && (
              <span className="inline-flex items-center gap-1.5 text-2xs text-ink-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                Fetching live prices…
              </span>
            )}
            <div className="flex items-center gap-1 bg-bg-subtle rounded-lg p-0.5 border border-border">
              {(["all", "long", "neutral", "short"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 h-7 text-xs font-medium rounded-md transition-colors capitalize",
                    filter === f
                      ? "bg-bg-card text-ink shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {f === "all" ? "All" : `${f} bias`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <CardContent className="!p-0">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-8" />
                <SortableTH k="symbol" label="Pair" />
                <SortableTH k="price" label="Price" align="right" />
                <SortableTH k="change24h" label="24h %" align="right" />
                <SortableTH k="volume24h" label="Volume 24h" align="right" />
                <SortableTH k="rsi" label="RSI" align="right" />
                <TH className="text-right">EMA</TH>
                <TH className="text-right">7d</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((m) => (
                <TR key={m.symbol} className="cursor-pointer">
                  <TD className="!pr-0">
                    <button className="text-ink-subtle hover:text-warn transition-colors">
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  </TD>
                  <TD>
                    <Link
                      to={`/markets/${encodeURIComponent(m.symbol)}`}
                      className="flex items-center gap-3 hover:text-brand-glow transition-colors"
                    >
                      <div className="h-7 w-7 rounded-full bg-bg-hover grid place-items-center text-2xs font-bold text-ink-muted">
                        {m.base.slice(0, 3)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-ink">{m.symbol}</div>
                        <div className="text-2xs text-ink-muted">{m.name}</div>
                      </div>
                    </Link>
                  </TD>
                  <TD className="text-right num font-medium text-ink">
                    {formatUSD(m.price)}
                  </TD>
                  <TD className={cn("text-right num font-medium", pctClass(m.change24h))}>
                    {formatPct(m.change24h)}
                  </TD>
                  <TD className="text-right num text-ink-muted">
                    {formatUSD(m.volume24h, { compact: true })}
                  </TD>
                  <TD className="text-right">
                    <RSIBar value={m.rsi} />
                  </TD>
                  <TD className="text-right">
                    <Badge
                      tone={
                        m.emaTrend === "long"
                          ? "bull"
                          : m.emaTrend === "short"
                            ? "bear"
                            : "neutral"
                      }
                    >
                      {m.emaTrend}
                    </Badge>
                  </TD>
                  <TD className="!py-2">
                    <div className="w-24 ml-auto">
                      <Sparkline data={m.sparkline.slice(-32)} height={32} />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {!isLoading && filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-ink-muted">
              {isError ? "Could not load markets. Check that the backend is running." : "No markets match your filters."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RSIBar({ value }: { value: number }) {
  const tone = value < 30 ? "bull" : value > 70 ? "bear" : "neutral";
  const color = value < 30 ? "bg-bull" : value > 70 ? "bg-bear" : "bg-ink-subtle";
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-16 h-1.5 bg-bg-subtle rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span
        className={cn(
          "num text-xs font-medium w-8 text-right",
          tone === "bull" && "text-bull",
          tone === "bear" && "text-bear",
          tone === "neutral" && "text-ink-muted",
        )}
      >
        {value.toFixed(0)}
      </span>
    </div>
  );
}
