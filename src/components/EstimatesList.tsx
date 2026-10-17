"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccessGate } from "./AccessGate";
import { STATUS_LABELS, type EstimateStatus, type EstimateSummary } from "@/lib/estimate-record";
import { gmFetch, loadAccessCode, rememberAccessCode } from "@/lib/gm-client";
import { pct, usd } from "@/lib/format";

const SERVICE = { removal: "Removal", trim: "Trim", stump: "Stump" } as const;
const STATUS_CLS: Record<EstimateStatus, string> = {
  draft: "bg-surface-2 text-ink-2",
  sent: "bg-brand-soft text-ink",
  won: "bg-brand text-on-brand",
  lost: "bg-surface-2 text-muted line-through",
};

export function StatusPill({ status }: { status: EstimateStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLS[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function EstimatesList() {
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<{ kind: "loading" | "ready" | "locked" | "error"; message?: string }>({ kind: "loading" });
  const [rows, setRows] = useState<EstimateSummary[]>([]);
  const [filter, setFilter] = useState<EstimateStatus | "all">("all");
  const [query, setQuery] = useState("");

  async function load(c: string) {
    setState({ kind: "loading" });
    try {
      const body = await gmFetch<{ estimates: EstimateSummary[] }>("/api/estimates", c);
      rememberAccessCode(c);
      setCode(c);
      setRows(body.estimates);
      setState({ kind: "ready" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't load estimates.";
      setState(/access code/i.test(message) ? { kind: "locked", message } : { kind: "error", message });
    }
  }

  useEffect(() => {
    const c = loadAccessCode();
    if (c) void load(c);
    else setState({ kind: "locked" });
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "all" || r.status === filter) &&
        (!q || `${r.customer.name} ${r.customer.address} ${r.customer.phone}`.toLowerCase().includes(q)),
    );
  }, [rows, filter, query]);

  const stats = useMemo(() => {
    const won = rows.filter((r) => r.status === "won");
    const lost = rows.filter((r) => r.status === "lost");
    const decided = won.length + lost.length;
    return {
      total: rows.length,
      open: rows.filter((r) => r.status === "draft" || r.status === "sent").length,
      winRate: decided ? won.length / decided : null,
      wonValue: won.reduce((a, r) => a + (r.finalPrice ?? (r.quote.priceLow + r.quote.priceHigh) / 2), 0),
      edited: rows.filter((r) => r.edited).length,
    };
  }, [rows]);

  if (state.kind === "locked") return <AccessGate message={state.message} onSubmit={(c) => void load(c)} />;
  if (state.kind === "loading") return <p className="text-ink-2">Loading estimates…</p>;
  if (state.kind === "error") return <p role="alert" className="rounded-md border border-warn/40 bg-warn-soft px-3 py-2 text-sm">{state.message}</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          ["Estimates", String(stats.total), `${stats.open} open`],
          ["Win rate", stats.winRate === null ? "–" : pct(stats.winRate), "Won ÷ (won + lost)"],
          ["Won work", usd(stats.wonValue), "Final price, or quote midpoint"],
          ["AI reads corrected", stats.total ? pct(stats.edited / stats.total) : "–", `${stats.edited} of ${stats.total} edited by GM`],
        ].map(([label, value, sub]) => (
          <div key={label} className="min-w-0 rounded-xl border border-line bg-surface p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular">{value}</p>
            <p className="mt-1 text-xs text-muted">{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "draft", "sent", "won", "lost"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-full border px-3 py-1 text-sm ${filter === f ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-2"}`}
          >
            {f === "all" ? "All" : STATUS_LABELS[f]}
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, address, phone"
          aria-label="Search estimates"
          className="ml-auto w-full sm:w-64 rounded-md border border-line bg-surface px-3 py-1.5 text-sm"
        />
      </div>

      <div className="rounded-xl border border-line bg-surface">
        {visible.length === 0 ? (
          <p className="p-6 text-sm text-ink-2">
            {rows.length === 0 ? (
              <>No saved estimates yet. Every photo analysis on the <Link href="/estimator" className="underline">job estimator</Link> is saved here automatically.</>
            ) : (
              "No estimates match."
            )}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-4 py-3 font-normal">Date</th>
                  <th className="px-4 py-3 font-normal">Customer</th>
                  <th className="px-4 py-3 font-normal">Job address</th>
                  <th className="px-4 py-3 font-normal">Work</th>
                  <th className="px-4 py-3 font-normal text-right">Quote</th>
                  <th className="px-4 py-3 font-normal text-right">Final</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-t border-line hover:bg-surface-2">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Link href={`/estimates/${r.id}`} className="underline-offset-2 hover:underline">
                        {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{r.customer.name || <span className="text-muted">No name</span>}</td>
                    <td className="px-4 py-2.5 max-w-64 truncate">{r.customer.address || <span className="text-muted">–</span>}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {SERVICE[r.service]} · {r.locality}
                      {r.edited && <span className="ml-1.5 rounded bg-brand-soft px-1 text-[10px]">edited</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{usd(r.quote.priceLow)}–{usd(r.quote.priceHigh)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{r.finalPrice === null ? <span className="text-muted">–</span> : usd(r.finalPrice)}</td>
                    <td className="px-4 py-2.5"><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {code && <p className="text-xs text-muted">Showing {visible.length} of {rows.length}. Photos and details are private to the GM access code.</p>}
    </div>
  );
}
