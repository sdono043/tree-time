import { describe, expect, it } from "vitest";
import { model, projectMonths, summarize } from "./model";

const within = (actual: number, target: number, pct: number) =>
  Math.abs(actual - target) <= Math.abs(target) * pct;

describe("financial model", () => {
  const s = summarize(projectMonths());

  it("reproduces the deck's Year 1 totals within tolerance", () => {
    expect(within(s.revenue, model.deckTargets.year1Revenue, 0.02)).toBe(true);
    expect(within(s.cost, model.deckTargets.year1OperatingCost, 0.02)).toBe(true);
    expect(within(s.net, model.deckTargets.year1Net, 0.05)).toBe(true);
  });

  it("breaks even in month 8 or 9 and never runs out of cash", () => {
    expect([8, 9]).toContain(s.breakevenMonth);
    expect(s.lowestCash).toBeGreaterThan(0);
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
