"use client";

import { useEffect, useState } from "react";
import { LineChart } from "./charts/LineChart";
import { BarChart } from "./charts/BarChart";
import { model, projectMonths, summarize } from "@/lib/model";
import { AS_OF, SAMPLE_LEADS, type Lead, type LeadStatus } from "@/lib/sample-data";
import { crewUtilization, jobsByWeek, leadsBySource, trailingKpis } from "@/lib/metrics";
import { pct, usd, usdK } from "@/lib/format";
import { clearLocalLeads, loadLocalLeads } from "@/lib/leads-store";
import { dporClassFor } from "@/lib/pricing";

const rows = projectMonths();
const plan = summarize(rows);
const CURRENT_MONTH = 7; // AS_OF falls in model month 7
const current = rows[CURRENT_MONTH - 1];
const kpis = trailingKpis(SAMPLE_LEADS, AS_OF);
const util = crewUtilization(SAMPLE_LEADS, AS_OF);
const weeks = jobsByWeek(SAMPLE_LEADS, AS_OF);
const sources = leadsBySource(SAMPLE_LEADS);
const WEEKS_PER_MONTH = 52 / 12;
const planJobsPerWeek = current.jobs / WEEKS_PER_MONTH;
const capacityJobsPerWeek = model.capacity.jobsPerMonthAtCapacity / WEEKS_PER_MONTH;
const asOfLabel = new Date(AS_OF).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const breakevenLabel = plan.breakevenMonth ? rows[plan.breakevenMonth - 1].label : "not in Year 1";

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

const SERVICE_LABEL = { trim: "Trim", removal: "Removal", stump: "Stump" } as const;

export function Dashboard() {
  const [localLeads, setLocalLeads] = useState<Lead[]>([]);
  useEffect(() => setLocalLeads(loadLocalLeads()), []);

  const recent = [...localLeads, ...[...SAMPLE_LEADS].reverse().slice(0, 8)];
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
              ["Net", usd(plan.net), usdK(model.deckTargets.year1Net)],
              ["Break-even month", `Month ${plan.breakevenMonth}`, `Month ${model.deckTargets.breakevenMonth}`],
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
        <Card title="Projected cash balance" subtitle={`Starts at ${usdK(model.capital.raise)} raised, less startup spend`}>
          <LineChart
            ariaLabel="Projected month-end cash balance for Year 1"
            labels={rows.map((r) => r.label)}
            series={[{ name: "Cash balance", color: "var(--series-1)", values: rows.map((r) => r.cash) }]}
            format={usdK}
            area
            marker={{ index: plan.lowestCashMonth - 1, text: `Low ${usdK(plan.lowestCash)}` }}
          />
          <p className="mt-3 text-xs text-ink-2">
            The ramp leaves a thin cushion around break-even. A slow spring or a higher workers&apos; comp quote would push the
            low point below zero, so the GM&apos;s first 90 days of bookings are the number to watch.
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

      <Card title="Recent quote requests" subtitle="Requests made on the instant-quote page in this browser appear first">
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
                    {!l.demo && <span className="ml-1.5 rounded bg-brand px-1.5 py-0.5 text-[10px] text-on-brand font-sans">yours</span>}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{l.createdAt}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{l.name}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{l.neighborhood}</td>
                  <td className="py-2 pr-3">{SERVICE_LABEL[l.service]}</td>
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
        {localLeads.length > 0 && (
          <button
            type="button"
            className="mt-3 text-xs text-muted underline"
            onClick={() => {
              clearLocalLeads();
              setLocalLeads([]);
            }}
          >
            Clear my demo requests
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
            <li>Equipment is rented in Year 1 (2 trucks, 2 chippers, grinder per use). Financing owned equipment around Month 12 changes the cost lines.</li>
            <li>Wood resale is treated as a disposal-cost offset, not a profit line.</li>
            <li>The GM hire and crew safety discipline are the biggest risks to this plan. Neither shows up in a spreadsheet.</li>
            <li>Operational tiles and tables use seeded sample leads as of {asOfLabel}; the plan charts come from <code className="text-xs">src/data/financial-model.json</code>.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
