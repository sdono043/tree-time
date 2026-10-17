// Deterministic demo data: a plausible lead/job history for the first ~7 months
// of operation, so the dashboard can be shown without real customers.
import type { Service } from "./pricing";

export type LeadStatus = "new" | "quoted" | "booked" | "completed" | "lost";
export type LeadSource = "Instant quote" | "Google" | "Nextdoor" | "Referral" | "HOA / commercial" | "Storm line";
export type Crew = "Crew A" | "Crew B";

export interface Lead {
  id: string;
  createdAt: string; // ISO date
  name: string;
  neighborhood: string;
  service: Service;
  source: LeadSource;
  quoteLow: number;
  quoteHigh: number;
  status: LeadStatus;
  jobValue: number | null;
  crew: Crew | null;
  crewDays: number | null;
  demo?: boolean;
}

/** "Today" for the demo: end of model month 7. */
export const AS_OF = "2027-07-30";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NEIGHBORHOODS = [
  "The Fan", "Museum District", "Church Hill", "Westover Hills", "Windsor Farms",
  "Near West End", "Short Pump", "Glen Allen", "Lakeside", "Bon Air",
  "Midlothian", "Chesterfield Courthouse", "Brandermill", "Forest Hill", "Mechanicsville",
];
const FIRST = ["James", "Maria", "Robert", "Linda", "David", "Patricia", "Kevin", "Angela", "Chris", "Denise", "Mark", "Tanya", "Paul", "Grace", "Andre", "Hannah"];
const LAST = ["Carter", "Nguyen", "Brooks", "Wallace", "Patel", "Hughes", "Foster", "Bennett", "Reyes", "Coleman", "Price", "Jenkins", "Ward", "Simmons"];
const SOURCES: [LeadSource, number][] = [
  ["Instant quote", 0.34], ["Google", 0.24], ["Referral", 0.16], ["Nextdoor", 0.12], ["HOA / commercial", 0.09], ["Storm line", 0.05],
];
const SERVICES: [Service, number, number, number][] = [
  // service, weight, typical low, typical high
  ["trim", 0.42, 400, 900],
  ["removal", 0.43, 650, 1600],
  ["stump", 0.15, 175, 500],
];

function pick<T>(rand: () => number, weighted: [T, number, ...unknown[]][]): [T, number, ...unknown[]] {
  let r = rand();
  for (const w of weighted) {
    if ((r -= w[1]) <= 0) return w;
  }
  return weighted[weighted.length - 1];
}

export function generateLeads(seed = 804): Lead[] {
  const rand = mulberry32(seed);
  const leads: Lead[] = [];
  const start = Date.UTC(2027, 0, 4); // first Monday of Jan 2027
  const end = Date.parse(AS_OF);
  const day = 86_400_000;
  let n = 0;

  for (let t = start; t <= end; t += day) {
    const weekday = new Date(t).getUTCDay();
    if (weekday === 0) continue;
    const progress = (t - start) / (end - start); // 0 → 1 over the ramp
    const expected = (1.2 + 2.4 * progress) * (weekday === 6 ? 0.5 : 1);
    const count = Math.floor(expected + rand());
    for (let i = 0; i < count; i++) {
      n++;
      const [source] = pick(rand, SOURCES);
      const [service, , lo, hi] = pick(rand, SERVICES) as [Service, number, number, number];
      const quoteLow = Math.round((lo + rand() * (hi - lo) * 0.6) / 25) * 25;
      const quoteHigh = Math.round((quoteLow * (1.35 + rand() * 0.4)) / 25) * 25;
      const ageDays = (end - t) / day;
      const closeOdds = source === "Referral" || source === "HOA / commercial" ? 0.7 : source === "Storm line" ? 0.8 : 0.5;

      let status: LeadStatus;
      if (ageDays < 2) status = "new";
      else if (ageDays < 6 && rand() < 0.5) status = "quoted";
      else if (rand() < closeOdds) status = ageDays < 9 ? "booked" : "completed";
      else status = "lost";

      const won = status === "booked" || status === "completed";
      const jobValue = won ? Math.round((quoteLow + rand() * (quoteHigh - quoteLow)) / 25) * 25 : null;
      leads.push({
        id: `RTC-${String(1000 + n)}`,
        createdAt: new Date(t).toISOString().slice(0, 10),
        name: `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`,
        neighborhood: NEIGHBORHOODS[Math.floor(rand() * NEIGHBORHOODS.length)],
        service,
        source,
        quoteLow,
        quoteHigh,
        status,
        jobValue,
        crew: won ? (rand() < 0.5 ? "Crew A" : "Crew B") : null,
        crewDays: won ? { stump: 0.25, trim: 0.5, removal: 1 }[service] : null,
        demo: true,
      });
    }
  }
  return leads;
}

export const SAMPLE_LEADS = generateLeads();
