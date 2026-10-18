"use client";

import { useEffect, useState } from "react";
import { LineChart } from "./charts/LineChart";
import { BarChart } from "./charts/BarChart";
import { AccessGate } from "./AccessGate";
import { financedMonthly, model, projectMonths, summarize, type MonthRow, type Strategy } from "@/lib/model";
import { AS_OF, SAMPLE_LEADS, type Lead, type LeadStatus } from "@/lib/sample-data";
import { crewUtilization, jobsByWeek, leadsBySource, trailingKpis } from "@/lib/metrics";
import { pct, usd, usdK } from "@/lib/format";
import { clearLocalLeads, loadLocalLeads } from "@/lib/leads-store";
import { dporClassFor, SERVICE_LABELS } from "@/lib/pricing";
import { gmFetch, loadAccessCode, rememberAccessCode } from "@/lib/gm-client";

const STRATEGIES = Object.keys(model.equipment.strategies) as Strategy[];
const SCENARIOS = Object.fromEntries(
  STRATEGIES.map((st) => {
    const rows = projectMonths(model, st);
    return [st, { rows, plan: summarize(rows) }];
  }),
) as Record<Strategy, { rows: MonthRow[]; plan: ReturnType<typeof summarize> }>;
const CURRENT_MONTH = 7; // AS_OF falls in model month 7
const kpis = trailingKpis(SAMPLE_LEADS, AS_OF);
const util = crewUtilization(SAMPLE_LEADS, AS_OF);
const weeks = jobsByWeek(SAMPLE_LEADS, AS_OF);
const sources = leadsBySource(SAMPLE_LEADS);
const WEEKS_PER_MONTH = 52 / 12;
const capacityJobsPerWeek = model.capacity.jobsPerMonthAtCapacity / WEEKS_PER_MONTH;
const asOfLabel = new Date(AS_OF).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const usdRange = ([lo, hi]: number[]) => `${usdK(lo)}–${usdK(hi)}`;

function Delta({ now, prev, format, invert = false }: { now: number; prev: number; format: (n: number) => string; invert?: boolean }) {
  const diff = now - prev;
  if (Math.abs(diff) < 1e-9) return <span className="text-muted">No change vs prior 4 wks</span>;
  const up = diff > 0;
  const good = invert ? !up : up;
  return (
    <span className={good ? "text-good" : "text-bad"}>
      {up ? "▲" : "▼"} {format(Math.abs(diff))} <span className="text-muted">vs prior 4 wks</span>
    </span>
  );
}

function Tile({ label, value, sub, children }: { label: string; value: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular">{value}</p>
      {sub && <p className="mt-1 text-xs">{sub}</p>}
      {children}
    </div>
  );
}

function Card({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-surface p-5 ${className}`}>
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const STATUS: Record<LeadStatus, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-brand-soft text-ink" },
  quoted: { label: "Quoted", cls: "bg-surface-2 text-ink" },
  booked: { label: "Booked", cls: "bg-brand-soft text-ink" },
  completed: { label: "Completed", cls: "bg-surface-2 text-ink-2" },
  lost: { label: "Lost", cls: "bg-surface-2 text-muted" },
};

type LiveState =
  | { kind: "idle" }
  | { kind: "locked"; message?: string }
  | { kind: "loading" }
  | { kind: "ready"; leads: Lead[] }
  | { kind: "unavailable"; message: string };

export function Dashboard() {
  const [strategy, setStrategy] = useState<Strategy>(model.equipment.defaultStrategy as Strategy);
  const { rows, plan } = SCENARIOS[strategy];
  const other = STRATEGIES.find((st) => st !== strategy)!;
  const current = rows[CURRENT_MONTH - 1];
  const planJobsPerWeek = current.jobs / WEEKS_PER_MONTH;
  const breakevenLabel = plan.breakevenMonth ? rows[plan.breakevenMonth - 1].label : "not in Year 1";

  const [localLeads, setLocalLeads] = useState<Lead[]>([]);
  const [live, setLive] = useState<LiveState>({ kind: "idle" });
  useEffect(() => setLocalLeads(loadLocalLeads()), []);

  async function loadLive(code: string) {
    setLive({ kind: "loading" });
    try {
      const body = await gmFetch<{ leads: Lead[] }>("/api/leads", code);
      rememberAccessCode(code);
      setLive({ kind: "ready", leads: body.leads });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't load requests.";
      setLive(/access code/i.test(message) ? { kind: "locked", message } : { kind: "unavailable", message });
    }
  }
  useEffect(() => {
    const code = loadAccessCode();
    if (code) void loadLive(code);
  }, []);

  const liveLeads = live.kind === "ready" ? live.leads : [];
  const liveIds = new Set(liveLeads.map((l) => l.id));
  const browserOnly = localLeads.filter((l) => !liveIds.has(l.id));
  const recent = [...liveLeads, ...browserOnly, ...[...SAMPLE_LEADS].reverse().slice(0, 8)];
  const browserIds = new Set(browserOnly.map((l) => l.id));
  const avgUtil = (util["Crew A"] + util["Crew B"]) / 2;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Tile
          label="Jobs / week (trailing 4 wks)"
          value={kpis.current.jobsPerWeek.toFixed(1)}
          sub={<span className="text-muted">Plan {planJobsPerWeek.toFixed(1)} · capacity {capacityJobsPerWeek.toFixed(0)}</span>}
        />
        <Tile
          label="Close rate"
          value={pct(kpis.current.closeRate)}
          sub={<Delta now={kpis.current.closeRate * 100} prev={kpis.previous.closeRate * 100} format={(n) => `${Math.round(n)} pts`} />}
        />
        <Tile
          label="Average ticket"
          value={usd(kpis.current.avgTicket)}
          sub={<span className="text-muted">Target {usd(model.capacity.blendedTicketAtCapacity)} blended</span>}
        />
        <Tile label="Crew utilization" value={pct(avgUtil)} sub={<span className="text-muted">Booked crew-days ÷ available</span>} />
        <Tile
          label="Cash on hand (plan)"
          value={usdK(current.cash)}
          sub={<span className="text-warn">Low point {usdK(plan.lowestCash)} in {rows[plan.lowestCashMonth - 1].label}</span>}
        />
      </div>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-5 py-4">
        <div>
          <h2 className="font-semibold">Equipment strategy</h2>
          <p className="text-xs text-muted mt-0.5">Every plan chart and table below follows this choice.</p>
        </div>
        <div role="radiogroup" aria-label="Equipment strategy" className="inline-flex rounded-lg border border-line bg-surface-2 p-1 text-sm">
          {STRATEGIES.map((st) => (
            <button
              key={st}
              type="button"
              role="radio"
              aria-checked={strategy === st}
              onClick={() => setStrategy(st)}
              className={`rounded-md px-3 py-1.5 ${strategy === st ? "bg-surface font-medium shadow-sm" : "text-ink-2"}`}
            >
              {model.equipment.strategies[st].label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Year 1 plan: revenue vs. operating cost" subtitle={`Monthly, from financial-model.json · break-even ${breakevenLabel}`} className="lg:col-span-2">
          <LineChart
            ariaLabel="Monthly revenue and operating cost for Year 1"
            labels={rows.map((r) => r.label)}
            series={[
              { name: "Revenue", color: "var(--series-1)", values: rows.map((r) => r.revenue) },
              { name: "Operating cost", color: "var(--series-2)", values: rows.map((r) => r.cost) },
            ]}
            format={usdK}
          />
        </Card>
        <Card title="Year 1 at a glance" subtitle="Deck targets in brackets">
          <dl className="space-y-3 text-sm">
            {[
              ["Revenue", usd(plan.revenue), usdK(model.deckTargets.year1Revenue)],
              ["Operating cost", usd(plan.cost), usdK(model.deckTargets.year1OperatingCost)],
              ["of which equipment", usd(plan.equipment), "not itemized in deck"],
              ["Net", usd(plan.net), usdK(model.deckTargets.year1Net)],
              ["Break-even month", plan.breakevenMonth ? `Month ${plan.breakevenMonth}` : "Not in Year 1", `Month ${model.deckTargets.breakevenMonth}`],
              ["Lowest cash", usd(plan.lowestCash), "deck assumed it stays positive"],
              ["Month 12 margin", usd(plan.exitRunRateMargin), `$${model.deckTargets.phase2MonthlyMargin} (Phase 2)`],
            ].map(([k, v, t]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-line pb-2 last:border-0">
                <dt className="text-ink-2">{k}</dt>
                <dd className="text-right tabular">
                  {v} <span className="text-muted text-xs block">[{t}]</span>
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Projected cash balance" subtitle={`Starts at ${usdK(model.capital.raise)} raised, less startup spend and equipment down payments`}>
          <LineChart
            ariaLabel="Projected month-end cash balance for Year 1 under both equipment strategies"
            labels={rows.map((r) => r.label)}
            series={[
              { name: model.equipment.strategies[strategy].label, color: "var(--series-1)", values: rows.map((r) => r.cash) },
              { name: model.equipment.strategies[other].label, color: "var(--series-2)", values: SCENARIOS[other].rows.map((r) => r.cash) },
            ]}
            format={usdK}
            marker={{ index: plan.lowestCashMonth - 1, text: `Low ${usdK(plan.lowestCash)}` }}
          />
          <p className="mt-3 text-xs text-ink-2">
            {plan.lowestCash < 0
              ? `Cash goes below zero: the plan needs about ${usdK(-plan.lowestCash)} more than the raise (a credit line, more capital, or smaller down payments). `
              : "Cash stays positive, but the cushion around break-even is thin. "}
            Renting everything at retail rates costs {usdK(SCENARIOS.rent.plan.equipment - SCENARIOS.finance.plan.equipment)} more in
            Year 1 than financing the core fleet used.
          </p>
        </Card>
        <Card title="Won jobs per week" subtitle="Last 12 weeks, by lead date · sample data">
          <BarChart
            ariaLabel="Won jobs per week for the last 12 weeks"
            labels={weeks.map((w) => w.label)}
            values={weeks.map((w) => w.jobs)}
            color="var(--series-1)"
            format={(n) => `${Math.round(n)} jobs`}
            axisFormat={(n) => String(Math.round(n))}
            detail={(i) => usd(weeks[i].revenue)}
          />
          <p className="mt-3 text-xs text-ink-2">The latest week is still filling in as quotes convert.</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Crew utilization" subtitle="Trailing 4 weeks">
          <ul className="space-y-4">
            {(Object.keys(util) as (keyof typeof util)[]).map((crew) => (
              <li key={crew}>
                <div className="flex justify-between text-sm">
                  <span>{crew}</span>
                  <span className="tabular">{pct(util[crew])}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-surface-2">
                  <div className="h-2 rounded-full" style={{ width: pct(Math.min(1, util[crew])), background: "var(--series-1)" }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-2">
            Plan for this month: {pct(current.utilization)} of the {model.capacity.jobsPerMonthAtCapacity}-jobs/month capacity across {model.capacity.crews} crews of {model.capacity.crewSize}.
          </p>
        </Card>
        <Card title="Where jobs come from" subtitle="All leads since launch · sample data" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-2 font-normal">Source</th>
                  <th className="pb-2 font-normal text-right">Leads</th>
                  <th className="pb-2 font-normal text-right">Won</th>
                  <th className="pb-2 font-normal text-right">Close rate</th>
                  <th className="pb-2 font-normal text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source} className="border-t border-line">
                    <td className="py-2">{s.source}</td>
                    <td className="py-2 text-right">{s.leads}</td>
                    <td className="py-2 text-right">{s.won}</td>
                    <td className="py-2 text-right">{pct(s.closeRate)}</td>
                    <td className="py-2 text-right">{usd(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card
        title="Equipment: rent vs. buy"
        subtitle={`Per unit · rentals include a ${pct(model.equipment.rentalDamageWaiverPct)} damage waiver · financing at ${(model.equipment.financing.aprPct * 100).toFixed(1)}% APR over ${model.equipment.financing.termMonths} months with ${pct(model.equipment.financing.downPaymentPct)} down, used midpoint price`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 pr-3 font-normal">Equipment</th>
                <th className="pb-2 pr-3 font-normal">How it&apos;s used</th>
                <th className="pb-2 pr-3 font-normal text-right">Rent / day</th>
                <th className="pb-2 pr-3 font-normal text-right">Rent / month</th>
                <th className="pb-2 pr-3 font-normal text-right">Buy used</th>
                <th className="pb-2 pr-3 font-normal text-right">Down payment</th>
                <th className="pb-2 pr-3 font-normal text-right">Owned / month</th>
                <th className="pb-2 pr-3 font-normal text-right">Buy new</th>
                <th className="pb-2 font-normal">This plan</th>
              </tr>
            </thead>
            <tbody>
              {model.equipment.items.map((item) => {
                const f = financedMonthly(item);
                const financed = (model.equipment.strategies[strategy].finance as string[]).includes(item.id);
                const per = "perUse" in item ? (item.perUse as { shareOfJobs: number; jobsPerDay: number }) : null;
                return (
                  <tr key={item.id} className="border-t border-line align-top">
                    <td className="py-2 pr-3">{item.name}</td>
                    <td className="py-2 pr-3 text-xs text-ink-2">
                      {per
                        ? `${pct(per.shareOfJobs)} of jobs, ${per.jobsPerDay} jobs/day`
                        : `${item.unitStartMonths.length} units, from month ${item.unitStartMonths.join(" and ")}`}
                    </td>
                    <td className="py-2 pr-3 text-right">{usd(item.rent.daily)}</td>
                    <td className="py-2 pr-3 text-right">{usd(item.rent.monthly)}</td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">{usdRange(item.buyUsed)}</td>
                    <td className="py-2 pr-3 text-right">{usd(f.downPayment)}</td>
                    <td className="py-2 pr-3 text-right" title={`${usd(f.payment)} loan + ${usd(f.maintenance)} maintenance`}>
                      {usd(f.total)}
                      <span className="block text-[11px] text-muted">{usd(f.payment)} loan + {usd(f.maintenance)} upkeep</span>
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">{usdRange(item.buyNew)}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${financed ? "bg-brand-soft" : "bg-surface-2"}`}>
                        {financed ? "Finance" : per ? "Rent by the day" : "Rent monthly"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-2">
          Cranes aren&apos;t here: they&apos;re hired with an operator (about $1,600 per half day) and billed through to the customer.
          Delivery fees ($75–$200 each way) and fuel for rented units aren&apos;t included. Rates are benchmarks to replace with
          Sunbelt, United and dealer quotes.
        </p>
      </Card>

      <Card title="Monthly cash flow, Year 1" subtitle={`${model.equipment.strategies[strategy].label} · cash basis: loan payments count as cost, down payments come out of cash`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular">
            <thead>
              <tr className="text-muted">
                <th className="pb-2 pr-3 text-left font-normal sticky left-0 bg-surface">Line</th>
                {rows.map((r) => <th key={r.month} className="pb-2 pl-2 text-right font-normal whitespace-nowrap">{r.label}</th>)}
                <th className="pb-2 pl-3 text-right font-medium">Year 1</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const lines: { label: string; values: number[]; strong?: boolean; indent?: boolean; sign?: -1 }[] = [
                  { label: "Revenue", values: rows.map((r) => r.revenue), strong: true },
                  { label: "Crew, GM, insurance, admin", values: rows.map((r) => r.fixedCost), sign: -1 },
                  { label: "Fuel, dump fees, consumables", values: rows.map((r) => r.variableCost), sign: -1 },
                  { label: "Marketing", values: rows.map((r) => r.marketing), sign: -1 },
                  { label: "Equipment", values: rows.map((r) => r.equipment), sign: -1 },
                  ...model.equipment.items.map((item) => ({
                    label: item.name,
                    values: rows.map((r) => r.equipmentLines.find((l) => l.id === item.id)?.cost ?? 0),
                    indent: true,
                    sign: -1 as const,
                  })),
                  { label: "Operating net", values: rows.map((r) => r.net), strong: true },
                  { label: "Equipment down payments", values: rows.map((r) => r.downPayments), sign: -1 },
                  { label: "Cash at month end", values: rows.map((r) => r.cash), strong: true },
                ];
                return lines.map((l) => {
                  const total = l.label === "Cash at month end" ? l.values[l.values.length - 1] : l.values.reduce((a, b) => a + b, 0);
                  const fmt = (n: number) => (n === 0 ? "–" : usdK((l.sign ?? 1) * n));
                  return (
                    <tr key={l.label} className={`border-t border-line ${l.strong ? "font-medium" : ""} ${l.indent ? "text-ink-2" : ""}`}>
                      <td className={`py-1.5 pr-3 sticky left-0 bg-surface whitespace-nowrap ${l.indent ? "pl-3" : ""}`}>{l.label}</td>
                      {l.values.map((v, i) => (
                        <td key={i} className={`py-1.5 pl-2 text-right whitespace-nowrap ${l.strong && v < 0 ? "text-bad" : ""}`}>{fmt(v)}</td>
                      ))}
                      <td className={`py-1.5 pl-3 text-right whitespace-nowrap font-medium ${l.strong && total < 0 ? "text-bad" : ""}`}>{fmt(total)}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Recent quote requests" subtitle="Live requests from the instant-quote page first (GM access code), then sample data">
        {(live.kind === "idle" || live.kind === "locked") && (
          <div className="mb-4">
            {live.kind === "idle" ? (
              <button type="button" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2" onClick={() => setLive({ kind: "locked" })}>
                Show live requests
              </button>
            ) : (
              <AccessGate message={live.message ?? "Customer contact details are for the GM only."} onSubmit={(c) => void loadLive(c)} />
            )}
          </div>
        )}
        {live.kind === "loading" && <p className="mb-3 text-sm text-muted">Loading live requests…</p>}
        {live.kind === "unavailable" && <p className="mb-3 text-sm text-ink-2">{live.message} Showing requests saved in this browser.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 font-normal">Ref</th>
                <th className="pb-2 font-normal">Date</th>
                <th className="pb-2 font-normal">Customer</th>
                <th className="pb-2 font-normal">Area</th>
                <th className="pb-2 font-normal">Service</th>
                <th className="pb-2 font-normal">Source</th>
                <th className="pb-2 pr-3 font-normal text-right">Estimate</th>
                <th className="pb-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((l) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap">
                    {l.id}
                    {liveIds.has(l.id) && <span className="ml-1.5 rounded bg-brand px-1.5 py-0.5 text-[10px] text-on-brand font-sans">live</span>}
                    {browserIds.has(l.id) && <span className="ml-1.5 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-sans">this browser</span>}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{l.createdAt}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{l.name}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{l.neighborhood}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{(l.services ?? [l.service]).map((sv) => SERVICE_LABELS[sv]).join(" + ")}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{l.source}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">
                    {usd(l.quoteLow)}–{usd(l.quoteHigh)}
                    {dporClassFor(l.quoteHigh) !== "None" && (
                      <span className="block text-[11px] text-muted" title="Virginia DPOR contractor class implied by the contract value">
                        DPOR {dporClassFor(l.quoteHigh)}
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[l.status].cls}`}>{STATUS[l.status].label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {browserOnly.length > 0 && (
          <button
            type="button"
            className="mt-3 text-xs text-muted underline"
            onClick={() => {
              clearLocalLeads();
              setLocalLeads([]);
            }}
          >
            Clear requests saved in this browser
          </button>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Use of the capital raise" subtitle={`${usd(model.capital.raise)} raised`}>
          <table className="w-full text-sm tabular">
            <tbody>
              {model.capital.uses.map((u) => (
                <tr key={u.label} className="border-t border-line first:border-0">
                  <td className="py-2 pr-3 text-ink-2">{u.label}</td>
                  <td className="py-2 text-right">{usd(u.amount)}</td>
                </tr>
              ))}
              <tr className="border-t border-line font-medium">
                <td className="py-2">Total itemized</td>
                <td className="py-2 text-right">{usd(model.capital.uses.reduce((a, u) => a + u.amount, 0))}</td>
              </tr>
            </tbody>
          </table>
        </Card>
        <Card title="Read before relying on these numbers">
          <ul className="space-y-2 text-sm text-ink-2 list-disc pl-4">
            <li>Every cost is an industry benchmark, not a Richmond quote. GL and workers&apos; comp premiums and rental rates move the model most.</li>
            <li>Equipment follows the strategy picked above. Renting a full fleet at retail rates costs about {(SCENARIOS.rent.plan.equipment / SCENARIOS.finance.plan.equipment).toFixed(1)}× as much as financing it used; financing used units needs about {usdK(SCENARIOS.finance.plan.downPayments)} in down payments that the capital plan doesn&apos;t yet cover.</li>
            <li>Wood resale is treated as a disposal-cost offset, not a profit line.</li>
            <li>The GM hire and crew safety discipline are the biggest risks to this plan. Neither shows up in a spreadsheet.</li>
            <li>Operational tiles and tables use seeded sample leads as of {asOfLabel}; the plan charts come from <code className="text-xs">src/data/financial-model.json</code>.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
