import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT, dporClassFor, estimateQuote } from "./pricing";

describe("estimateQuote", () => {
  it("prices a basic medium removal within the benchmark band", () => {
    const q = estimateQuote(DEFAULT_INPUT);
    expect(q.low).toBe(750);
    expect(q.high).toBe(1600);
    expect(q.needsSiteVisit).toBe(false);
  });

  it("adds stump grinding and applies access/hazard multipliers", () => {
    const base = estimateQuote(DEFAULT_INPUT);
    const harder = estimateQuote({ ...DEFAULT_INPUT, access: "backyard", hazard: "structure", stumps: 1 });
    expect(harder.low).toBeGreaterThan(base.low);
    expect(harder.lineItems.map((l) => l.label)).toContain("Stump grinding: 1 stump");
  });

  it("treats stump-only jobs as at least one stump and ignores tree size", () => {
    const q = estimateQuote({ ...DEFAULT_INPUT, service: "stump", stumps: 0, size: "xl" });
    expect(q.lineItems).toHaveLength(1);
    expect(q.low).toBeGreaterThanOrEqual(200);
  });

  it("flags powerline jobs for a site visit and marks up emergencies", () => {
    const normal = estimateQuote({ ...DEFAULT_INPUT, hazard: "powerline" });
    const storm = estimateQuote({ ...DEFAULT_INPUT, hazard: "powerline", emergency: true });
    expect(normal.needsSiteVisit).toBe(true);
    expect(storm.high).toBeGreaterThan(normal.high * 1.4);
  });

  it("keeps the range ordered and at least the job minimum", () => {
    const q = estimateQuote({ ...DEFAULT_INPUT, service: "trim", size: "small", cleanup: "none" });
    expect(q.low).toBeGreaterThanOrEqual(200);
    expect(q.high).toBeGreaterThan(q.low);
  });
});

describe("dporClassFor", () => {
  it("follows Virginia contract-value thresholds", () => {
    expect(dporClassFor(900)).toBe("None");
    expect(dporClassFor(1500)).toBe("Class C");
    expect(dporClassFor(25000)).toBe("Class B");
    expect(dporClassFor(200000)).toBe("Class A");
  });
});
