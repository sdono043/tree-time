import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT, dporClassFor, estimateQuote } from "./pricing";

describe("estimateQuote", () => {
  it("prices a basic medium removal within the benchmark band", () => {
    const q = estimateQuote(DEFAULT_INPUT);
    expect(q.low).toBe(750);
    expect(q.high).toBe(1600);
    expect(q.needsSiteVisit).toBe(false);
  });

  it("combines removal and stump grinding in one quote", () => {
    const base = estimateQuote(DEFAULT_INPUT);
    const both = estimateQuote({ ...DEFAULT_INPUT, services: ["removal", "stump"], stumps: 1 });
    expect(both.lineItems.map((l) => l.label)).toEqual(["Removal: 1 tree, 25–50 ft", "Stump grinding: 1 stump"]);
    expect(both.low).toBe(base.low + 175);
  });

  it("prices trims and removals on the same visit separately", () => {
    const q = estimateQuote({ ...DEFAULT_INPUT, services: ["trim", "removal"], trimCount: 2, removeCount: 1 });
    expect(q.lineItems.map((l) => l.label)).toEqual(["Removal: 1 tree, 25–50 ft", "Trimming: 2 trees, 25–50 ft"]);
  });

  it("applies access and target multipliers, and stacks targets", () => {
    const base = estimateQuote(DEFAULT_INPUT);
    const house = estimateQuote({ ...DEFAULT_INPUT, access: "backyard", targets: ["structure"] });
    const both = estimateQuote({ ...DEFAULT_INPUT, access: "backyard", targets: ["structure", "powerline"] });
    expect(house.low).toBeGreaterThan(base.low);
    expect(both.low).toBeGreaterThan(house.low);
  });

  it("treats stump-only jobs as at least one stump and ignores tree questions", () => {
    const q = estimateQuote({ ...DEFAULT_INPUT, services: ["stump"], stumps: 0, size: "xl", road: "close", targets: ["powerline"] });
    expect(q.lineItems).toHaveLength(1);
    expect(q.low).toBeGreaterThanOrEqual(200);
    expect(q.needsSiteVisit).toBe(false);
  });

  it("adds a bucket truck for 50–75 ft trees the truck can reach", () => {
    const q = estimateQuote({ ...DEFAULT_INPUT, size: "large" });
    expect(q.lineItems.find((l) => l.label.startsWith("Bucket truck"))).toMatchObject({ low: 650, high: 900 });
    const gated = estimateQuote({ ...DEFAULT_INPUT, size: "large", access: "backyard" });
    expect(gated.lineItems.some((l) => l.label.startsWith("Bucket truck"))).toBe(false);
  });

  it("carries a crane allowance for very tall removals over a house", () => {
    const q = estimateQuote({ ...DEFAULT_INPUT, size: "xl", targets: ["structure"] });
    expect(q.lineItems.find((l) => l.label.startsWith("Crane"))).toMatchObject({ low: 0, high: 2500 });
    expect(q.needsSiteVisit).toBe(true);
  });

  it("prices traffic control near the road and sends trunk-near-curb jobs to a site visit", () => {
    const over = estimateQuote({ ...DEFAULT_INPUT, road: "overhang" });
    const close = estimateQuote({ ...DEFAULT_INPUT, road: "close" });
    expect(over.lineItems.map((l) => l.label)).toContain("Traffic control: signs, cones, flagger");
    expect(over.needsSiteVisit).toBe(false);
    expect(close.lineItems.map((l) => l.label)).toContain("Right-of-way permit and lane closure");
    expect(close.needsSiteVisit).toBe(true);
    expect(close.notes.join(" ")).toMatch(/right-of-way permit/);
  });

  it("flags powerline jobs for a site visit and marks up emergencies", () => {
    const normal = estimateQuote({ ...DEFAULT_INPUT, targets: ["powerline"] });
    const storm = estimateQuote({ ...DEFAULT_INPUT, targets: ["powerline"], emergency: true });
    expect(normal.needsSiteVisit).toBe(true);
    expect(storm.high).toBeGreaterThan(normal.high * 1.4);
  });

  it("keeps the range ordered and at least the job minimum", () => {
    const q = estimateQuote({ ...DEFAULT_INPUT, services: ["trim"], size: "small", cleanup: "none" });
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
