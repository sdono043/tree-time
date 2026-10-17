import type { Crew, Lead } from "./sample-data";

const DAY = 86_400_000;
const WORKDAYS_PER_WEEK = 5;

export interface WeekBucket {
  weekStart: string;
  label: string;
  jobs: number;
  revenue: number;
}

function mondayOf(iso: string): number {
  const t = Date.parse(iso);
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return t - dow * DAY;
}

const isWon = (l: Lead) => l.status === "booked" || l.status === "completed";

/** Won jobs per week (by lead date) for the `weeks` weeks ending at asOf. */
export function jobsByWeek(leads: Lead[], asOf: string, weeks = 12): WeekBucket[] {
  const lastMonday = mondayOf(asOf);
  return Array.from({ length: weeks }, (_, i) => {
    const start = lastMonday - (weeks - 1 - i) * 7 * DAY;
    const inWeek = leads.filter((l) => {
      const t = Date.parse(l.createdAt);
      return isWon(l) && t >= start && t < start + 7 * DAY;
    });
    const d = new Date(start);
    return {
      weekStart: d.toISOString().slice(0, 10),
      label: d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      jobs: inWeek.length,
      revenue: inWeek.reduce((a, l) => a + (l.jobValue ?? 0), 0),
    };
  });
}

/**
 * KPIs over a trailing `days` window. The window ends `settleDays` before asOf so
 * that the leads in it have had time to be quoted and won or lost.
 */
export function trailingKpis(leads: Lead[], asOf: string, days = 28, settleDays = 7) {
  const end = Date.parse(asOf) + DAY - settleDays * DAY;
  const start = end - days * DAY;
  const prevStart = start - days * DAY;
  const inRange = (l: Lead, a: number, b: number) => {
    const t = Date.parse(l.createdAt);
    return t >= a && t < b;
  };

  const calc = (a: number, b: number) => {
    const window = leads.filter((l) => inRange(l, a, b));
    const decided = window.filter((l) => l.status !== "new" && l.status !== "quoted");
    const won = window.filter(isWon);
    const revenue = won.reduce((s, l) => s + (l.jobValue ?? 0), 0);
    return {
      leads: window.length,
      jobs: won.length,
      jobsPerWeek: won.length / (days / 7),
      closeRate: decided.length ? won.length / decided.length : 0,
      avgTicket: won.length ? revenue / won.length : 0,
      revenue,
    };
  };

  return { current: calc(start, end), previous: calc(prevStart, start) };
}

/** Booked crew-days as a share of available crew-days over the trailing window. */
export function crewUtilization(leads: Lead[], asOf: string, days = 28): Record<Crew, number> {
  const end = Date.parse(asOf) + DAY;
  const start = end - days * DAY;
  const available = (days / 7) * WORKDAYS_PER_WEEK;
  const result: Record<Crew, number> = { "Crew A": 0, "Crew B": 0 };
  for (const l of leads) {
    const t = Date.parse(l.createdAt);
    if (l.crew && l.crewDays && t >= start && t < end) result[l.crew] += l.crewDays;
  }
  return { "Crew A": result["Crew A"] / available, "Crew B": result["Crew B"] / available };
}

export function leadsBySource(leads: Lead[]) {
  const map = new Map<string, { leads: number; won: number; revenue: number }>();
  for (const l of leads) {
    const row = map.get(l.source) ?? { leads: 0, won: 0, revenue: 0 };
    row.leads++;
    if (isWon(l)) {
      row.won++;
      row.revenue += l.jobValue ?? 0;
    }
    map.set(l.source, row);
  }
  return [...map.entries()]
    .map(([source, r]) => ({ source, ...r, closeRate: r.won / r.leads }))
    .sort((a, b) => b.revenue - a.revenue);
}
