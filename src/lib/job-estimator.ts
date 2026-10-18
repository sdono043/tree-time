// Turns a job assessment (from photos, possibly edited by the GM) into an
// itemized, cost-plus quote. Every number traces back to rate-card.json.
import rateCard from "@/data/rate-card.json";
import type { JobAssessment, TreeAssessment } from "./assessment";
import { dporClassFor } from "./pricing";

export type Service = "removal" | "trim" | "stump";
export type Locality = "Richmond" | "Henrico" | "Chesterfield";
export type Method = "fell" | "climb_and_rig" | "bucket_truck" | "crane";

export interface JobOptions {
  service: Service;
  locality: Locality;
  grindStumps: boolean;
  haulDebris: boolean;
  historicDistrict: boolean;
}

export const DEFAULT_OPTIONS: JobOptions = {
  service: "removal",
  locality: "Richmond",
  grindStumps: true,
  haulDebris: true,
  historicDistrict: false,
};

export type FlagLevel = "stop" | "visit" | "check" | "info";
export interface Flag {
  level: FlagLevel;
  title: string;
  detail: string;
}

const FLAG_ORDER: Record<FlagLevel, number> = { stop: 0, visit: 1, check: 2, info: 3 };

export interface CostLine {
  group: "Labor" | "Equipment" | "Disposal" | "Other";
  label: string;
  low: number;
  high: number;
}

export interface TreePlan {
  label: string;
  method: Method;
  reasons: string[];
  hoursLow: number;
  hoursHigh: number;
}

export interface JobEstimate {
  trees: TreePlan[];
  method: Method;
  crew: { climbers: number; ground: number; total: number };
  onSiteHoursLow: number;
  onSiteHoursHigh: number;
  days: number;
  lines: CostLine[];
  costLow: number;
  costHigh: number;
  priceLow: number;
  priceHigh: number;
  flags: Flag[];
  dporClass: string;
}

export const METHOD_LABELS: Record<Method, string> = {
  fell: "Fell in one piece",
  climb_and_rig: "Climb and rig down in sections",
  bucket_truck: "Bucket truck",
  crane: "Crane-assisted removal",
};

const R = rateCard;
const round = (n: number, step = 1) => Math.round(n / step) * step;
const mid = (a: number, b: number) => (a + b) / 2;

function sizeClass(heightFt: number): keyof typeof R.productivity.removalHoursByHeight {
  if (heightFt < 25) return "small";
  if (heightFt < 50) return "medium";
  if (heightFt < 75) return "large";
  return "xl";
}

/** Crew-on-site hours for one tree at a given height and trunk diameter, before method and site factors. */
function baseHours(service: Service, heightFt: number, dbhIn: number): number {
  if (service === "stump") return 0;
  const byHeight = R.productivity.removalHoursByHeight[sizeClass(heightFt)];
  // Wood volume grows faster than height; scale by trunk size around a 20" reference.
  const girth = Math.sqrt(Math.max(dbhIn, 4) / 20);
  const removal = byHeight * girth;
  return service === "trim" ? removal * R.productivity.trimFractionOfRemoval : removal;
}

const CLIMB_UNSAFE = (t: TreeAssessment) => t.condition === "dead" || t.condition === "storm_damaged" || t.lean === "severe";

function chooseMethod(job: JobAssessment, tree: TreeAssessment, service: Service): { method: Method; reasons: string[] } {
  const reasons: string[] = [];
  const height = mid(tree.heightFtLow, tree.heightFtHigh);
  const dbh = mid(tree.trunkDiameterInLow, tree.trunkDiameterInHigh);
  const hasTargets = job.targets.length > 0;
  const truckClose = job.truckAccess === "driveway_adjacent" && job.terrain !== "steep";

  if (service === "removal" && job.dropZone === "open_fell_possible" && !hasTargets && height < 70) {
    reasons.push("Open drop zone with nothing to hit");
    return { method: "fell", reasons };
  }
  if (
    service === "removal" &&
    hasTargets &&
    job.dropZone === "no_drop_zone" &&
    (height >= 60 || dbh >= 30 || (CLIMB_UNSAFE(tree) && !truckClose))
  ) {
    reasons.push("Large wood over targets with no room to lower it");
    if (CLIMB_UNSAFE(tree)) reasons.push("Tree condition makes climbing it unsafe");
    return { method: "crane", reasons };
  }
  if (truckClose && height <= 60) {
    reasons.push("Truck can park beside the tree and it's within bucket reach");
    if (CLIMB_UNSAFE(tree)) reasons.push("Avoids climbing a compromised tree");
    return { method: "bucket_truck", reasons };
  }
  reasons.push(hasTargets ? "Pieces must be lowered on ropes to protect targets" : "No equipment access or beyond bucket reach");
  if (CLIMB_UNSAFE(tree)) reasons.push("Compromised tree: crew lead must confirm it's climbable on-site");
  return { method: "climb_and_rig", reasons };
}

const METHOD_SPEED: Record<Method, number> = { fell: 0.6, climb_and_rig: 1, bucket_truck: 0.75, crane: 0.55 };

function siteFactor(job: JobAssessment, tree: TreeAssessment): number {
  let f = 1;
  if (job.truckAccess === "through_gate") f *= 1.25; // dragging brush to the chipper
  if (job.truckAccess === "no_vehicle_access") f *= 1.5;
  if (job.terrain === "moderate_slope") f *= 1.1;
  if (job.terrain === "steep") f *= 1.3;
  if (tree.lean === "severe") f *= 1.2;
  if (tree.condition === "dead" || tree.condition === "storm_damaged") f *= 1.2;
  if (job.powerLines === "service_drop_nearby" || job.powerLines === "primary_lines_nearby") f *= 1.15;
  return f;
}

export function estimateJob(job: JobAssessment, opts: JobOptions): JobEstimate {
  const flags: Flag[] = [];
  const lines: CostLine[] = [];
  const service = opts.service;

  // --- Per-tree plans --------------------------------------------------------
  const trees: TreePlan[] = job.trees.map((t) => {
    const { method, reasons } = service === "stump" ? { method: "fell" as Method, reasons: [] } : chooseMethod(job, t, service);
    const speed = service === "trim" && method === "fell" ? 1 : METHOD_SPEED[method];
    const f = siteFactor(job, t) * speed;
    return {
      label: t.label,
      method,
      reasons,
      hoursLow: baseHours(service, t.heightFtLow, t.trunkDiameterInLow) * f,
      hoursHigh: baseHours(service, t.heightFtHigh, t.trunkDiameterInHigh) * f,
    };
  });

  const methods = new Set(trees.map((t) => t.method));
  const method: Method = methods.has("crane") ? "crane" : methods.has("bucket_truck") ? "bucket_truck" : methods.has("climb_and_rig") ? "climb_and_rig" : "fell";

  // --- Stumps ----------------------------------------------------------------
  const stumpDiameters =
    service === "stump"
      ? job.trees.map((t) => mid(t.trunkDiameterInLow, t.trunkDiameterInHigh) * 1.2)
      : opts.grindStumps && service === "removal"
        ? job.trees.map((t) => mid(t.trunkDiameterInLow, t.trunkDiameterInHigh) * 1.2)
        : [];
  const grindHours = stumpDiameters.reduce((a, d) => a + (d * R.productivity.stumpGrindMinutesPerInch) / 60, 0);

  // --- Crew ------------------------------------------------------------------
  const treeHoursLow = trees.reduce((a, t) => a + t.hoursLow, 0);
  const treeHoursHigh = trees.reduce((a, t) => a + t.hoursHigh, 0);
  const anyLarge = job.trees.some((t) => t.heightFtHigh >= 50);
  // Every tree job has a crew lead (climber or sawyer); nobody runs a saw alone.
  const climbers = service === "stump" ? 0 : 1;
  const ground = service === "stump" ? 1 : method === "crane" ? 3 : anyLarge || job.truckAccess !== "driveway_adjacent" ? 2 : 1;
  const crewTotal = climbers + ground;
  const onSiteHoursLow = Math.max(1, treeHoursLow + grindHours * 0.5); // grinding overlaps cleanup
  const onSiteHoursHigh = Math.max(1.5, treeHoursHigh + grindHours * 0.75);
  const days = Math.max(1, Math.ceil(onSiteHoursHigh / R.productivity.crewHoursPerDay));

  // --- Labor -----------------------------------------------------------------
  if (climbers) {
    lines.push({ group: "Labor", label: method === "fell" ? "Crew lead / sawyer" : `Climber / crew lead × ${climbers}`, low: onSiteHoursLow * R.labor.climberPerHour, high: onSiteHoursHigh * R.labor.climberPerHour });
  }
  lines.push({ group: "Labor", label: `Ground crew × ${ground}`, low: onSiteHoursLow * ground * R.labor.groundPerHour, high: onSiteHoursHigh * ground * R.labor.groundPerHour });

  // --- Equipment -------------------------------------------------------------
  lines.push({ group: "Equipment", label: `Crew truck × ${days} day${days > 1 ? "s" : ""}`, low: R.equipment.crewTruckPerDay * days, high: R.equipment.crewTruckPerDay * days });
  if (service !== "stump" && opts.haulDebris) {
    lines.push({ group: "Equipment", label: "Chipper", low: R.equipment.chipperPerDay * days, high: R.equipment.chipperPerDay * days });
  }
  if (method === "bucket_truck") {
    lines.push({ group: "Equipment", label: "Bucket truck", low: R.equipment.bucketTruckPerDay * days, high: R.equipment.bucketTruckPerDay * days });
  }
  if (method === "crane") {
    const craneHours = (h: number) => Math.max(0, h * 0.6 - 4);
    lines.push({
      group: "Equipment",
      label: "Crane with operator (half-day minimum)",
      low: R.equipment.cranePerHalfDay + craneHours(onSiteHoursLow) * R.equipment.craneExtraHour,
      high: R.equipment.cranePerHalfDay + craneHours(onSiteHoursHigh) * R.equipment.craneExtraHour,
    });
  }
  if (method === "climb_and_rig" || method === "crane") {
    lines.push({ group: "Equipment", label: "Rigging wear and consumables", low: R.equipment.riggingWearPerJob, high: R.equipment.riggingWearPerJob });
  }
  if (job.truckAccess === "no_vehicle_access" && service === "removal" && anyLarge) {
    lines.push({ group: "Equipment", label: "Mini loader to move logs", low: R.equipment.miniLoaderPerDay * days, high: R.equipment.miniLoaderPerDay * days });
  }
  if (stumpDiameters.length) {
    const hrs = Math.max(R.equipment.stumpGrinderMinimumHours, grindHours);
    lines.push({
      group: "Equipment",
      label: `Stump grinder: ${stumpDiameters.length} stump${stumpDiameters.length > 1 ? "s" : ""}`,
      low: hrs * R.equipment.stumpGrinderPerHour,
      high: hrs * 1.3 * R.equipment.stumpGrinderPerHour,
    });
  }

  // --- Disposal --------------------------------------------------------------
  if (opts.haulDebris && service !== "stump") {
    // Rough chipped + log volume: proportional to height × diameter².
    const yards = (t: TreeAssessment, h: number, d: number) => {
      const v = (h * d * d) / 1400;
      return service === "trim" ? v * 0.25 : v;
    };
    const ydLow = job.trees.reduce((a, t) => a + yards(t, t.heightFtLow, t.trunkDiameterInLow), 0);
    const ydHigh = job.trees.reduce((a, t) => a + yards(t, t.heightFtHigh, t.trunkDiameterInHigh), 0);
    const loads = (yd: number) => Math.max(1, Math.ceil(yd / R.disposal.cubicYardsPerLoad));
    lines.push({
      group: "Disposal",
      label: `Dump fees (${loads(ydLow) === loads(ydHigh) ? loads(ydLow) : `${loads(ydLow)}–${loads(ydHigh)}`} load${loads(ydHigh) > 1 ? "s" : ""})`,
      low: loads(ydLow) * R.disposal.perLoad,
      high: loads(ydHigh) * R.disposal.perLoad,
    });
  }
  if (job.nearRoadway && service !== "stump") {
    const tc = R.equipment.trafficControlPerDay * days + R.equipment.rightOfWayPermit;
    lines.push({ group: "Other", label: "Traffic control and right-of-way permit", low: tc, high: tc });
  }
  lines.push({ group: "Other", label: "Mobilization and travel", low: R.travel.mobilizationPerJob, high: R.travel.mobilizationPerJob });

  // --- Totals ----------------------------------------------------------------
  const sum = (k: "low" | "high") => lines.reduce((a, l) => a + l[k], 0);
  const costLow = sum("low");
  // Low-confidence reads widen the top of the range rather than hide the uncertainty.
  const spread = job.overallConfidence === "low" ? 1.2 : job.overallConfidence === "medium" ? 1.08 : 1;
  const costHigh = sum("high") * spread;
  const toPrice = (c: number) => (c * (1 + R.markup.overheadPct)) / (1 - R.markup.targetMarginPct);
  const priceLow = Math.max(R.markup.minimumJobPrice, round(toPrice(costLow), 25));
  const priceHigh = Math.max(priceLow + 50, round(toPrice(costHigh), 25));

  // --- Flags -----------------------------------------------------------------
  if (job.powerLines === "lines_in_canopy") {
    flags.push({
      level: "stop",
      title: "Power lines in the canopy",
      detail: "Only line-clearance qualified crews may work within 10 ft of energized lines (OSHA 1910.269 / 1910.333). Call Dominion Energy to de-energize or clear first. Don't send this quote until that's arranged.",
    });
  } else if (job.powerLines === "primary_lines_nearby") {
    flags.push({ level: "visit", title: "Primary lines nearby", detail: "Confirm the 10 ft minimum approach distance can be kept for every cut before quoting firm." });
  } else if (job.powerLines === "service_drop_nearby") {
    flags.push({ level: "check", title: "Service drop nearby", detail: "Plan the cut sequence to stay clear of the house line; Dominion can drop it for free with notice." });
  }
  if (method === "crane") {
    flags.push({ level: "visit", title: "Crane job", detail: "Needs a site visit for crane setup, outrigger pads and the ground under them, and a lift plan." });
  }
  if (job.trees.some((t) => t.heightFtHigh >= 75)) {
    flags.push({ level: "visit", title: "Very tall tree", detail: "Height estimates from photos are least reliable above 75 ft. Confirm on-site." });
  }
  if (job.trees.some(CLIMB_UNSAFE) && method === "climb_and_rig") {
    flags.push({ level: "visit", title: "Compromised tree", detail: "Dead, storm-damaged or severely leaning. The crew lead must confirm it can be climbed safely, or switch to bucket or crane." });
  }
  if (job.overallConfidence === "low" || job.photoQuality === "poor") {
    flags.push({ level: "visit", title: "Low-confidence read", detail: "Photos weren't clear enough to quote firmly. Request better photos or visit." });
  }
  if (job.nearRoadway) {
    flags.push({
      level: "check",
      title: "Public right-of-way",
      detail:
        opts.locality === "Richmond"
          ? "Trees in the city right-of-way belong to the City of Richmond (Urban Forestry). Owner can't authorize removal; a right-of-way permit is needed to block the street or sidewalk."
          : `Work blocking a ${opts.locality} County or VDOT road needs a land-use / right-of-way permit and traffic control.`,
    });
  }
  if (job.nearWater) {
    flags.push({ level: "check", title: "Possible Chesapeake Bay buffer (RPA)", detail: `Tree removal within a Resource Protection Area needs ${opts.locality} approval and may require replanting. Check the locality's RPA map.` });
  }
  if (opts.historicDistrict) {
    flags.push({ level: "check", title: "Historic district", detail: "Some old-and-historic districts review tree removal visible from the street. Confirm with the locality before scheduling." });
  }
  const dpor = dporClassFor(priceHigh);
  if (dpor !== "None") {
    flags.push({
      level: "info",
      title: `DPOR ${dpor} contract`,
      detail: `Contract value over $1,000. Virginia requires the contracting license class to cover it${stumpDiameters.length ? "; stump grinding is below-grade work" : ""}.`,
    });
  }
  flags.push({ level: "info", title: `${opts.locality} business license`, detail: `Confirm the BPOL license for ${opts.locality} is current.` });

  return {
    trees,
    method,
    crew: { climbers, ground, total: crewTotal },
    onSiteHoursLow,
    onSiteHoursHigh,
    days,
    lines: lines.map((l) => ({ ...l, low: round(l.low), high: round(l.high) })),
    costLow: round(costLow),
    costHigh: round(costHigh),
    priceLow,
    priceHigh,
    flags: flags.sort((x, y) => FLAG_ORDER[x.level] - FLAG_ORDER[y.level]),
    dporClass: dpor,
  };
}
