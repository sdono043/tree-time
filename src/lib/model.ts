import model from "@/data/financial-model.json";

export type FinancialModel = typeof model;

export interface MonthRow {
  month: number;
  label: string;
  jobs: number;
  avgTicket: number;
  serviceRevenue: number;
  woodResale: number;
  revenue: number;
  fixedCost: number;
  variableCost: number;
  marketing: number;
  cost: number;
  net: number;
  cumulativeNet: number;
  cash: number;
  utilization: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function monthLabel(start: string, offset: number): string {
  const [y, m] = start.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

/**
 * Projects the monthly P&L and cash position from the model's assumptions.
 * Labor ramps with `laborRamp` (crew 2 is brought on partway through the ramp);
 * every other fixed cost is paid in full from month 1.
 */
export function projectMonths(m: FinancialModel = model): MonthRow[] {
  const fixed = m.costs.fixedMonthly;
  const laborKeys = ["Crew labor + payroll tax", "Workers' comp"] as const;
  const laborFixed = sum(laborKeys.map((k) => fixed[k]));
  const otherFixed = sum(Object.values(fixed)) - laborFixed;
  const variablePerJob = sum(Object.values(m.costs.variablePerJob));
  const startupSpend = m.capital.raise - (m.capital.uses.find((u) => u.label.startsWith("Ramp"))?.amount ?? 0);

  let cumulativeNet = 0;
  return m.monthly.jobs.map((jobs, i) => {
    const avgTicket = m.monthly.avgTicket[i];
    const serviceRevenue = jobs * avgTicket;
    const woodResale = m.monthly.woodResale[i];
    const revenue = serviceRevenue + woodResale;
    const fixedCost = otherFixed + laborFixed * m.costs.laborRamp[i];
    const variableCost = jobs * variablePerJob;
    const marketing = m.costs.marketingMonthly[i];
    const cost = fixedCost + variableCost + marketing;
    const net = revenue - cost;
    cumulativeNet += net;
    return {
      month: i + 1,
      label: monthLabel(m.meta.modelStart, i),
      jobs,
      avgTicket,
      serviceRevenue,
      woodResale,
      revenue,
      fixedCost,
      variableCost,
      marketing,
      cost,
      net,
      cumulativeNet,
      cash: m.capital.raise - startupSpend + cumulativeNet,
      utilization: jobs / m.capacity.jobsPerMonthAtCapacity,
    };
  });
}

export function summarize(rows: MonthRow[] = projectMonths()) {
  const revenue = sum(rows.map((r) => r.revenue));
  const cost = sum(rows.map((r) => r.cost));
  const breakeven = rows.find((r) => r.net >= 0);
  const trough = rows.reduce((lo, r) => (r.cash < lo.cash ? r : lo), rows[0]);
  return {
    revenue,
    cost,
    net: revenue - cost,
    breakevenMonth: breakeven?.month ?? null,
    lowestCash: trough.cash,
    lowestCashMonth: trough.month,
    endingCash: rows[rows.length - 1].cash,
    exitRunRateMargin: rows[rows.length - 1].net,
  };
}

export { model };
