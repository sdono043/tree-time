// Quote estimator pricing. Ranges are industry benchmarks for the Richmond
// metro, not quotes from local competitors; tune them as real jobs close.

export type Service = "trim" | "removal" | "stump";
export type TreeSize = "small" | "medium" | "large" | "xl";
export type Access = "open" | "backyard" | "tight";
export type Target = "structure" | "powerline";
export type Road = "none" | "overhang" | "close";
export type Cleanup = "full" | "leave-wood" | "none";
export type StumpSize = "small" | "medium" | "large";

export interface QuoteInput {
  services: Service[];
  removeCount: number;
  trimCount: number;
  size: TreeSize;
  access: Access;
  targets: Target[];
  road: Road;
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

export const SERVICE_LABELS: Record<Service, string> = { trim: "Trim", removal: "Removal", stump: "Stump" };

// Crew labor, crew truck, chipper and rigging for a climb-and-rig job. Lifts,
// cranes, loaders and traffic control are priced as their own line items below.
const BASE: Record<"trim" | "removal", Record<TreeSize, [number, number]>> = {
  trim: { small: [250, 450], medium: [450, 900], large: [900, 1600], xl: [1500, 2800] },
  removal: { small: [350, 750], medium: [750, 1600], large: [1500, 3000], xl: [2800, 5500] },
};

const STUMP: Record<StumpSize, [number, number]> = {
  small: [100, 175],
  medium: [175, 325],
  large: [325, 550],
};

// Customer price per day: rental or ownership cost plus overhead and margin,
// in line with rate-card.json and the equipment schedule in financial-model.json.
const BUCKET_TRUCK_PER_DAY: [number, number] = [650, 900];
const TREES_PER_BUCKET_DAY = 3;
const CRANE_ALLOWANCE: [number, number] = [0, 2500];
const LOADER_PER_DAY: [number, number] = [450, 600];
const TRAFFIC_CONTROL: Record<Exclude<Road, "none">, [number, number]> = {
  overhang: [250, 450], // signs, cones and a flagger while limbs come down over the street
  close: [450, 900], // right-of-way permit, lane closure and flaggers
};

const ACCESS_MULT: Record<Access, number> = { open: 1, backyard: 1.15, tight: 1.35 };
const TARGET_ADD: Record<Target, number> = { structure: 0.2, powerline: 0.3 };
const CLEANUP_MULT: Record<Cleanup, number> = { full: 1, "leave-wood": 0.9, none: 0.8 };
const DEAD_MULT = 1.15;
const EMERGENCY_MULT = 1.5;
const ADDITIONAL_TREE_DISCOUNT = 0.9;
const MIN_JOB = 200;

const roundTo = (n: number, step = 25) => Math.round(n / step) * step;
const whole = (n: number) => Math.max(0, Math.floor(n));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const DEFAULT_INPUT: QuoteInput = {
  services: ["removal"],
  removeCount: 1,
  trimCount: 1,
  size: "medium",
  access: "open",
  targets: [],
  road: "none",
  deadOrLeaning: false,
  stumps: 0,
  stumpSize: "medium",
  cleanup: "full",
  emergency: false,
};

/** The service a lead is filed under when several are requested. */
export function primaryService(services: Service[]): Service {
  return services.includes("removal") ? "removal" : services.includes("trim") ? "trim" : "stump";
}

export function estimateQuote(input: QuoteInput): QuoteEstimate {
  const lineItems: LineItem[] = [];
  const notes: string[] = [];
  const has = (s: Service) => input.services.includes(s);
  const removals = has("removal") ? whole(input.removeCount) : 0;
  const trims = has("trim") ? whole(input.trimCount) : 0;
  const treeWork = removals + trims;
  const stumps = has("stump") ? Math.max(1, whole(input.stumps)) : 0;

  const siteMult =
    ACCESS_MULT[input.access] *
    (1 + input.targets.reduce((a, t) => a + TARGET_ADD[t], 0)) *
    CLEANUP_MULT[input.cleanup] *
    (input.deadOrLeaning ? DEAD_MULT : 1);
  // First tree at full price; each additional tree on the same visit is discounted.
  const treeFactor = (n: number) => 1 + (n - 1) * ADDITIONAL_TREE_DISCOUNT;
  const sizeLabel = SIZE_LABELS[input.size].toLowerCase();

  for (const [service, count, verb] of [["removal", removals, "Removal"], ["trim", trims, "Trimming"]] as const) {
    if (count === 0) continue;
    const [bLow, bHigh] = BASE[service][input.size];
    lineItems.push({
      label: `${verb}: ${plural(count, "tree")}, ${sizeLabel}`,
      low: bLow * siteMult * treeFactor(count),
      high: bHigh * siteMult * treeFactor(count),
    });
  }

  // --- Equipment beyond the crew truck and chipper ---------------------------
  const hasStructure = input.targets.includes("structure");
  if (treeWork > 0) {
    const truckCanReach = input.access === "open";
    const bucketWork = (input.size === "large" || (input.size === "medium" && input.deadOrLeaning)) && truckCanReach;
    if (bucketWork) {
      const days = Math.ceil(treeWork / TREES_PER_BUCKET_DAY);
      lineItems.push({
        label: `Bucket truck (aerial lift), ${plural(days, "day")}`,
        low: BUCKET_TRUCK_PER_DAY[0] * days,
        high: BUCKET_TRUCK_PER_DAY[1] * days,
      });
    }
    if (input.size === "xl" && removals > 0 && (hasStructure || input.deadOrLeaning || input.access === "tight")) {
      lineItems.push({ label: "Crane allowance, only if needed", low: CRANE_ALLOWANCE[0], high: CRANE_ALLOWANCE[1] });
    }
    if (input.access === "tight" && removals > 0 && (input.size === "large" || input.size === "xl")) {
      lineItems.push({ label: "Compact loader to move logs", low: LOADER_PER_DAY[0], high: LOADER_PER_DAY[1] });
    }
    if (input.road !== "none") {
      const [tLow, tHigh] = TRAFFIC_CONTROL[input.road];
      lineItems.push({
        label: input.road === "close" ? "Right-of-way permit and lane closure" : "Traffic control: signs, cones, flagger",
        low: tLow,
        high: tHigh,
      });
    }
  }

  if (stumps > 0) {
    const [sLow, sHigh] = STUMP[input.stumpSize];
    lineItems.push({ label: `Stump grinding: ${plural(stumps, "stump")}`, low: sLow * stumps, high: sHigh * stumps });
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

  const hasPowerline = input.targets.includes("powerline");
  const needsSiteVisit =
    treeWork > 0 &&
    (hasPowerline || input.size === "xl" || input.access === "tight" || input.road === "close" || treeWork > 4);
  if (treeWork > 0 && hasPowerline) {
    notes.push("Lines touching the tree may need Dominion Energy to de-energize or clear them first. We coordinate that.");
  }
  if (treeWork > 0 && input.road === "close") {
    notes.push(
      "In the City of Richmond, trees between the sidewalk and the curb usually belong to the city, so we confirm ownership first. Closing a lane needs a right-of-way permit from the City, Henrico County or VDOT (Chesterfield roads), which can add lead time.",
    );
  } else if (treeWork > 0 && input.road === "overhang") {
    notes.push("Limbs over the street or sidewalk are lowered with a flagger and signs to keep traffic and walkers clear.");
  }
  if (treeWork > 0 && (input.size === "xl" || input.access === "tight")) {
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
