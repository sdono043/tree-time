import { describe, expect, it } from "vitest";
import { equipmentForMonth, loanPayment, model, projectMonths, summarize } from "./model";

const within = (actual: number, target: number, pct: number) =>
  Math.abs(actual - target) <= Math.abs(target) * pct;

describe("financial model", () => {
  const finance = summarize(projectMonths(model, "finance"));
  const rent = summarize(projectMonths(model, "rent"));

  it("financing the core fleet used stays close to the deck's Year 1 P&L", () => {
    expect(within(finance.revenue, model.deckTargets.year1Revenue, 0.02)).toBe(true);
    expect(within(finance.cost, model.deckTargets.year1OperatingCost, 0.03)).toBe(true);
    expect([8, 9]).toContain(finance.breakevenMonth);
  });

  it("renting everything at retail rates costs far more and never breaks even in Year 1", () => {
    expect(rent.equipment).toBeGreaterThan(finance.equipment * 2);
    expect(rent.breakevenMonth).toBeNull();
    expect(rent.downPayments).toBe(0);
  });

  it("takes equipment down payments out of cash, not operating cost", () => {
    const rows = projectMonths(model, "finance");
    expect(finance.downPayments).toBeGreaterThan(0);
    expect(rows[0].downPayments).toBeGreaterThan(0);
    const rentRows = projectMonths(model, "rent");
    // Same starting cash in both scenarios, so the gap in month 1 is the down payment plus the cost difference.
    expect(rentRows[0].cash - rows[0].cash).toBeCloseTo(rows[0].downPayments + rentRows[0].net - rows[0].net);
  });

  it("caps day rentals at the monthly rate", () => {
    const bucket = model.equipment.items.find((i) => i.id === "bucket-truck")!;
    const busy = equipmentForMonth(12, 1000, "rent").lines.find((l) => l.id === "bucket-truck")!;
    expect(busy.cost).toBeCloseTo(bucket.rent.monthly * (1 + model.equipment.rentalDamageWaiverPct));
  });

  it("computes loan payments", () => {
    expect(loanPayment(50000, 0.095, 60)).toBeCloseTo(1050.1, 0);
    expect(loanPayment(12000, 0, 12)).toBe(1000);
  });

  it("itemized capital uses stay within the raise", () => {
    const uses = model.capital.uses.reduce((a, u) => a + u.amount, 0);
    expect(uses).toBeLessThanOrEqual(model.capital.raise);
  });

  it("monthly arrays cover all 12 months", () => {
    for (const arr of [model.monthly.jobs, model.monthly.avgTicket, model.monthly.woodResale, model.costs.marketingMonthly, model.costs.laborRamp]) {
      expect(arr).toHaveLength(12);
    }
  });
});
