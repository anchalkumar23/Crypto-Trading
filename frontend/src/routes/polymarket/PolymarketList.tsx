import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, TrendingUp, Clock, Droplet, WifiOff, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { markets, type PolyMarketRow } from "@/lib/api";
import { formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Politics", "Crypto", "Sports", "Culture", "Economics", "Tech"] as const;
type Category = (typeof CATEGORIES)[number];
type SortKey = "volume" | "liquidity" | "endDate";

export function PolymarketList() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [sort, setSort] = useState<SortKey>("volume");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["polymarket", "list"],
    queryFn: markets.listPolymarket,
    refetchInterval: 60_000,
  });

  const live: PolyMarketRow[] = data ?? [];

  const filtered = useMemo(() => {
    let rows: PolyMarketRow[] = live;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((m) => m.question.toLowerCase().includes(q));
    }
    if (category !== "All") {
      rows = rows.filter((m) => m.category === category);
    }
    rows = [...rows].sort((a, b) => {
      if (sort === "volume") return b.volume24h - a.volume24h;
      if (sort === "liquidity") return b.liquidity - a.liquidity;
      return a.endDate - b.endDate;
    });
    return rows;
  }, [live, search, category, sort]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Polymarket"
        subtitle="Browse active prediction markets. Read-only — auto-trading is gated to v3 behind a burner-wallet wall."
      />

      {isError && (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-warn/30 bg-warn-bg text-xs">
          <WifiOff className="h-4 w-4 text-warn mt-0.5 flex-shrink-0" />
          <div className="text-ink-muted leading-relaxed">
            <span className="text-ink font-medium">Polymarket data unavailable.</span> The
            Gamma API may be temporarily down. Start the backend (port 8000) and try again.
          </div>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 p-4 border-b border-border">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions…"
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-bg-subtle border border-border text-sm placeholder:text-ink-subtle focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div className="flex items-center gap-1 bg-bg-subtle rounded-lg p-0.5 border border-border">
              {(
                [
                  { k: "volume", label: "24h Volume" },
                  { k: "liquidity", label: "Liquidity" },
                  { k: "endDate", label: "End Date" },
                ] as const
              ).map((s) => (
                <button
                  key={s.k}
                  onClick={() => setSort(s.k)}
                  className={cn(
                    "px-3 h-7 text-xs font-medium rounded-md transition-colors",
                    sort === s.k
                      ? "bg-bg-card text-ink shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "px-3 h-7 rounded-full text-xs font-medium transition-colors border",
                  category === c
                    ? "bg-brand/15 text-brand-glow border-brand/40"
                    : "bg-bg-subtle text-ink-muted border-border hover:text-ink",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <CardContent className="!p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-ink-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading markets…</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((m) => (
                  <PolyCard key={m.id} m={m} />
                ))}
              </div>
              {filtered.length === 0 && (
                <div className="py-12 text-center text-sm text-ink-muted">
                  {isError
                    ? "Could not load Polymarket data."
                    : "No markets match your filters."}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PolyCard({ m }: { m: PolyMarketRow }) {
  const yesPct = Math.round(m.yes * 100);
  const daysLeft = Math.max(0, Math.round((m.endDate - Date.now()) / 86400000));

  return (
    <Link
      to={`/polymarket/${m.slug}`}
      className="card card-hover p-4 flex flex-col gap-3 group"
    >
      <div className="flex items-center justify-between">
        <Badge tone="brand">{m.category}</Badge>
        <span className="text-2xs text-ink-muted inline-flex items-center gap-1 num">
          <Clock className="h-3 w-3" />
          {daysLeft}d left
        </span>
      </div>

      <h3 className="text-sm font-medium text-ink leading-snug line-clamp-2 group-hover:text-brand-glow transition-colors min-h-[2.5rem]">
        {m.question}
      </h3>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-2xs">
          <span className="text-ink-muted uppercase tracking-wider">Probability</span>
          <span className="num text-ink-muted">YES {yesPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-bear-bg overflow-hidden flex">
          <div className="bg-bull h-full transition-all" style={{ width: `${yesPct}%` }} />
          <div className="flex-1 bg-bear" />
        </div>
        <div className="flex items-center justify-between text-2xs num">
          <span className="text-bull font-semibold">YES {(m.yes * 100).toFixed(0)}¢</span>
          <span className="text-bear font-semibold">NO {(m.no * 100).toFixed(0)}¢</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-2xs text-ink-muted pt-2 border-t border-border num">
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {formatUSD(m.volume24h, { compact: true })}
        </span>
        <span className="inline-flex items-center gap-1">
          <Droplet className="h-3 w-3" />
          {formatUSD(m.liquidity, { compact: true })}
        </span>
      </div>
    </Link>
  );
}
