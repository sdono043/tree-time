import model from "@/data/financial-model.json";

export type FinancialModel = typeof model;
export type EquipmentItem = FinancialModel["equipment"]["items"][number];
export type Strategy = keyof FinancialModel["equipment"]["strategies"];

export interface EquipmentLine {
  id: string;
  name: string;
  mode: "rent" | "finance";
  /** Rental days this month for per-use rentals; null otherwise. */
  days: number | null;
  cost: number;
}

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
  /** Equipment rentals, or loan payments plus maintenance for financed units. */
  equipment: number;
  equipmentLines: EquipmentLine[];
  /** Cash put down on financed equipment this month (not an operating cost). */
  downPayments: number;
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

const midpoint = ([lo, hi]: number[]) => (lo + hi) / 2;

/** Monthly payment on a fixed-rate loan. */
export function loanPayment(principal: number, aprPct: number, termMonths: number): number {
  const r = aprPct / 12;
  return r === 0 ? principal / termMonths : (principal * r) / (1 - (1 + r) ** -termMonths);
}

/** Monthly cost of owning one unit bought used at the midpoint price: loan payment plus maintenance. */
export function financedMonthly(item: EquipmentItem, m: FinancialModel = model) {
  const price = midpoint(item.buyUsed);
  const f = m.equipment.financing;
  const payment = loanPayment(price * (1 - f.downPaymentPct), f.aprPct, f.termMonths);
  const maintenance = (price * item.maintenancePctPerYear) / 12;
  return { price, downPayment: price * f.downPaymentPct, payment, maintenance, total: payment + maintenance };
}

const withWaiver = (n: number, m: FinancialModel) => n * (1 + m.equipment.rentalDamageWaiverPct);

/** Equipment cost for one month under a strategy. `month` is 1-based. */
export function equipmentForMonth(month: number, jobs: number, strategy: Strategy, m: FinancialModel = model) {
  const financed = new Set<string>(m.equipment.strategies[strategy].finance);
  const lines: EquipmentLine[] = [];
  let downPayments = 0;
  for (const item of m.equipment.items) {
    const active = item.unitStartMonths.filter((s) => s <= month).length;
    if (active === 0) continue;
    if (financed.has(item.id)) {
      const f = financedMonthly(item, m);
      downPayments += item.unitStartMonths.filter((s) => s === month).length * f.downPayment;
      lines.push({ id: item.id, name: item.name, mode: "finance", days: null, cost: active * f.total });
    } else if (item.use === "fleet") {
      lines.push({ id: item.id, name: item.name, mode: "rent", days: null, cost: withWaiver(active * item.rent.monthly, m) });
    } else {
      const per = (item as EquipmentItem & { perUse: { shareOfJobs: number; jobsPerDay: number } }).perUse;
      const days = Math.ceil((jobs * per.shareOfJobs) / per.jobsPerDay);
      lines.push({ id: item.id, name: item.name, mode: "rent", days, cost: withWaiver(Math.min(days * item.rent.daily, active * item.rent.monthly), m) });
    }
  }
  return { lines, total: sum(lines.map((l) => l.cost)), downPayments };
}

/**
 * Projects the monthly P&L and cash position from the model's assumptions.
 * Labor ramps with `laborRamp` (crew 2 is brought on partway through the ramp);
 * every other fixed cost is paid in full from month 1. Equipment follows the
 * chosen strategy; down payments on financed units come out of cash.
 */
export function projectMonths(m: FinancialModel = model, strategy: Strategy = m.equipment.defaultStrategy as Strategy): MonthRow[] {
  const fixed = m.costs.fixedMonthly;
  const laborKeys = ["Crew labor + payroll tax", "Workers' comp"] as const;
  const laborFixed = sum(laborKeys.map((k) => fixed[k]));
  const otherFixed = sum(Object.values(fixed)) - laborFixed;
  const variablePerJob = sum(Object.values(m.costs.variablePerJob));
  const startupSpend = m.capital.raise - (m.capital.uses.find((u) => u.label.startsWith("Ramp"))?.amount ?? 0);

  let cumulativeNet = 0;
  let cumulativeDown = 0;
  return m.monthly.jobs.map((jobs, i) => {
    const avgTicket = m.monthly.avgTicket[i];
    const serviceRevenue = jobs * avgTicket;
    const woodResale = m.monthly.woodResale[i];
    const revenue = serviceRevenue + woodResale;
    const fixedCost = otherFixed + laborFixed * m.costs.laborRamp[i];
    const variableCost = jobs * variablePerJob;
    const marketing = m.costs.marketingMonthly[i];
    const equip = equipmentForMonth(i + 1, jobs, strategy, m);
    const cost = fixedCost + variableCost + marketing + equip.total;
    const net = revenue - cost;
    cumulativeNet += net;
    cumulativeDown += equip.downPayments;
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
      equipment: equip.total,
      equipmentLines: equip.lines,
      downPayments: equip.downPayments,
      marketing,
      cost,
      net,
      cumulativeNet,
      cash: m.capital.raise - startupSpend - cumulativeDown + cumulativeNet,
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
    equipment: sum(rows.map((r) => r.equipment)),
    downPayments: sum(rows.map((r) => r.downPayments)),
    net: revenue - cost,
    breakevenMonth: breakeven?.month ?? null,
    lowestCash: trough.cash,
    lowestCashMonth: trough.month,
    endingCash: rows[rows.length - 1].cash,
    exitRunRateMargin: rows[rows.length - 1].net,
  };
}

export { model };
