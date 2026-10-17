// Quote estimator pricing. Ranges are industry benchmarks for the Richmond
// metro, not quotes from local competitors; tune them as real jobs close.

export type Service = "trim" | "removal" | "stump";
export type TreeSize = "small" | "medium" | "large" | "xl";
export type Access = "open" | "backyard" | "tight";
export type Hazard = "none" | "structure" | "powerline";
export type Cleanup = "full" | "leave-wood" | "none";
export type StumpSize = "small" | "medium" | "large";

export interface QuoteInput {
  service: Service;
  treeCount: number;
  size: TreeSize;
  access: Access;
  hazard: Hazard;
  deadOrLeaning: boolean;
  stumps: number;
  stumpSize: StumpSize;
  cleanup: Cleanup;
  emergency: boolean;
}

export interface LineItem {
  label: string;
  low: number;
  high: number;
}

export interface QuoteEstimate {
  low: number;
  high: number;
  lineItems: LineItem[];
  needsSiteVisit: boolean;
  notes: string[];
}

export const SIZE_LABELS: Record<TreeSize, string> = {
  small: "Under 25 ft",
  medium: "25–50 ft",
  large: "50–75 ft",
  xl: "Over 75 ft",
};

const BASE: Record<"trim" | "removal", Record<TreeSize, [number, number]>> = {
  trim: { small: [250, 450], medium: [450, 900], large: [900, 1600], xl: [1500, 2800] },
  removal: { small: [350, 750], medium: [750, 1600], large: [1500, 3000], xl: [2800, 5500] },
};

const STUMP: Record<StumpSize, [number, number]> = {
  small: [100, 175],
  medium: [175, 325],
  large: [325, 550],
};

const ACCESS_MULT: Record<Access, number> = { open: 1, backyard: 1.15, tight: 1.35 };
const HAZARD_MULT: Record<Hazard, number> = { none: 1, structure: 1.2, powerline: 1.3 };
const CLEANUP_MULT: Record<Cleanup, number> = { full: 1, "leave-wood": 0.9, none: 0.8 };
const DEAD_MULT = 1.15;
const EMERGENCY_MULT = 1.5;
const ADDITIONAL_TREE_DISCOUNT = 0.9;
const MIN_JOB = 200;

const roundTo = (n: number, step = 25) => Math.round(n / step) * step;

export const DEFAULT_INPUT: QuoteInput = {
  service: "removal",
  treeCount: 1,
  size: "medium",
  access: "open",
  hazard: "none",
  deadOrLeaning: false,
  stumps: 0,
  stumpSize: "medium",
  cleanup: "full",
  emergency: false,
};

export function estimateQuote(input: QuoteInput): QuoteEstimate {
  const lineItems: LineItem[] = [];
  const notes: string[] = [];
  const trees = Math.max(0, Math.floor(input.treeCount));
  const stumps = Math.max(0, Math.floor(input.stumps));

  if (input.service !== "stump" && trees > 0) {
    const [bLow, bHigh] = BASE[input.service][input.size];
    let mult = ACCESS_MULT[input.access] * HAZARD_MULT[input.hazard] * CLEANUP_MULT[input.cleanup];
    if (input.deadOrLeaning) mult *= DEAD_MULT;
    // First tree at full price; each additional tree on the same visit is discounted.
    const treeFactor = 1 + (trees - 1) * ADDITIONAL_TREE_DISCOUNT;
    const verb = input.service === "trim" ? "Trimming" : "Removal";
    lineItems.push({
      label: `${verb}: ${trees} tree${trees > 1 ? "s" : ""}, ${SIZE_LABELS[input.size].toLowerCase()}`,
      low: bLow * mult * treeFactor,
      high: bHigh * mult * treeFactor,
    });
  }

  const stumpCount = input.service === "stump" ? Math.max(1, stumps) : stumps;
  if (stumpCount > 0) {
    const [sLow, sHigh] = STUMP[input.stumpSize];
    lineItems.push({
      label: `Stump grinding: ${stumpCount} stump${stumpCount > 1 ? "s" : ""}`,
      low: sLow * stumpCount,
      high: sHigh * stumpCount,
    });
  }

  let low = lineItems.reduce((a, l) => a + l.low, 0);
  let high = lineItems.reduce((a, l) => a + l.high, 0);

  if (input.emergency) {
    lineItems.push({ label: "Storm / emergency response", low: low * (EMERGENCY_MULT - 1), high: high * (EMERGENCY_MULT - 1) });
    low *= EMERGENCY_MULT;
    high *= EMERGENCY_MULT;
  }

  low = Math.max(MIN_JOB, roundTo(low));
  high = Math.max(low + 50, roundTo(high));

  const needsSiteVisit =
    input.hazard === "powerline" || input.size === "xl" || input.access === "tight" || trees > 4;
  if (input.hazard === "powerline") {
    notes.push("Lines touching the tree may need Dominion Energy to de-energize or clear them first. We coordinate that.");
  }
  if (input.size === "xl" || input.access === "tight") {
    notes.push("Large or hard-to-reach trees can need a crane or extra rigging, which we confirm on-site.");
  }
  if (input.emergency) {
    notes.push("Storm calls are triaged by safety risk: trees on homes, cars or blocking driveways go first.");
  }
  notes.push("Final price is confirmed in writing before any work starts.");

  return {
    low,
    high,
    lineItems: lineItems.map((l) => ({ ...l, low: roundTo(l.low), high: roundTo(l.high) })),
    needsSiteVisit,
    notes,
  };
}

/**
 * Virginia DPOR contractor class implied by contract value. For internal use only:
 * tree work itself needs no state license, but contract size can trigger one
 * (especially for below-grade work like stump grinding).
 */
export function dporClassFor(contractValue: number): "None" | "Class C" | "Class B" | "Class A" {
  if (contractValue <= 1000) return "None";
  if (contractValue < 10000) return "Class C";
  if (contractValue <= 120000) return "Class B";
  return "Class A";
}
