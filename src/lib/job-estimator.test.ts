import { describe, expect, it } from "vitest";
import { JobAssessment } from "./assessment";
import { DEFAULT_OPTIONS, estimateJob } from "./job-estimator";
import { SAMPLE_JOBS } from "./sample-jobs";

const sample = (id: string) => {
  const s = SAMPLE_JOBS.find((j) => j.id === id)!;
  return { job: s.assessment, opts: { ...DEFAULT_OPTIONS, ...s.options } };
};

describe("sample jobs", () => {
  it("all validate against the assessment schema", () => {
    for (const s of SAMPLE_JOBS) expect(() => JobAssessment.parse(s.assessment)).not.toThrow();
  });

  it("pick the method a crew lead would", () => {
    const method = (id: string) => {
      const { job, opts } = sample(id);
      return estimateJob(job, opts).method;
    };
    expect(method("front-maple")).toBe("fell");
    expect(method("backyard-oak")).toBe("climb_and_rig");
    expect(method("dead-pine-street")).toBe("bucket_truck");
    expect(method("storm-poplar")).toBe("crane");
  });

  it("price harder jobs higher", () => {
    const price = (id: string) => {
      const { job, opts } = sample(id);
      return estimateJob(job, opts).priceHigh;
    };
    expect(price("front-maple")).toBeLessThan(price("dead-pine-street"));
    expect(price("dead-pine-street")).toBeLessThan(price("backyard-oak"));
    expect(price("backyard-oak")).toBeLessThan(price("storm-poplar"));
  });
});

describe("estimateJob", () => {
  it("never sends fewer than two people to a tree job", () => {
    for (const s of SAMPLE_JOBS) {
      expect(estimateJob(s.assessment, { ...DEFAULT_OPTIONS, ...s.options }).crew.total).toBeGreaterThanOrEqual(2);
    }
  });

  const { job, opts } = sample("backyard-oak");

  it("keeps ranges ordered and the price above cost", () => {
    const e = estimateJob(job, opts);
    expect(e.priceHigh).toBeGreaterThan(e.priceLow);
    expect(e.costHigh).toBeGreaterThanOrEqual(e.costLow);
    expect(e.priceLow).toBeGreaterThan(e.costLow);
  });

  it("stops the quote when lines are in the canopy", () => {
    const e = estimateJob({ ...job, powerLines: "lines_in_canopy" }, opts);
    expect(e.flags[0].level).toBe("stop");
  });

  it("lists the most serious flags first", () => {
    const e = estimateJob({ ...job, nearWater: true, overallConfidence: "low" }, opts);
    const order = { stop: 0, visit: 1, check: 2, info: 3 };
    const levels = e.flags.map((f) => order[f.level]);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it("flags right-of-way and RPA checks", () => {
    const e = estimateJob({ ...job, nearRoadway: true, nearWater: true }, opts);
    const titles = e.flags.map((f) => f.title);
    expect(titles).toContain("Public right-of-way");
    expect(titles).toContain("Possible Chesapeake Bay buffer (RPA)");
  });

  it("drops the climber and chipper for stump-only jobs", () => {
    const e = estimateJob(job, { ...opts, service: "stump" });
    expect(e.crew.climbers).toBe(0);
    expect(e.lines.some((l) => l.label === "Chipper")).toBe(false);
    expect(e.lines.some((l) => l.label.startsWith("Stump grinder"))).toBe(true);
  });

  it("trimming costs less than removal", () => {
    expect(estimateJob(job, { ...opts, service: "trim" }).priceHigh).toBeLessThan(estimateJob(job, opts).priceHigh);
  });

  it("widens the range for low-confidence reads", () => {
    const hi = estimateJob({ ...job, overallConfidence: "high" }, opts);
    const lo = estimateJob({ ...job, overallConfidence: "low" }, opts);
    expect(lo.priceHigh).toBeGreaterThan(hi.priceHigh);
    expect(lo.priceLow).toBe(hi.priceLow);
  });
});
