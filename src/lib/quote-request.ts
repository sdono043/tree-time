// Quote requests from the public /quote page, saved server-side in the same
// private Vercel Blob store as estimates:  quote-requests/<ref>.json
import { list, get, put } from "@vercel/blob";
import { z } from "zod";
import { estimateQuote, primaryService } from "./pricing";
import type { Lead } from "./sample-data";

const ROOT = "quote-requests/";
const REF_PATTERN = /^RTC-W[0-9A-Z]{6}$/;

const Service = z.enum(["trim", "removal", "stump"]);
const count = z.number().int().min(0).max(10);

export const QuoteInputSchema = z.object({
  services: z.array(Service).min(1).max(3),
  removeCount: count,
  trimCount: count,
  size: z.enum(["small", "medium", "large", "xl"]),
  access: z.enum(["open", "backyard", "tight"]),
  targets: z.array(z.enum(["structure", "powerline"])).max(2),
  road: z.enum(["none", "overhang", "close"]),
  deadOrLeaning: z.boolean(),
  stumps: count,
  stumpSize: z.enum(["small", "medium", "large"]),
  cleanup: z.enum(["full", "leave-wood", "none"]),
  emergency: z.boolean(),
});

/** What the browser sends. The price is recomputed on the server, never trusted from the client. */
export const QuoteRequestBody = z.object({
  contact: z.object({
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().min(7).max(50),
    email: z.string().trim().max(200),
    address: z.string().trim().min(1).max(300),
    neighborhood: z.string().trim().max(100),
    window: z.string().trim().max(50),
  }),
  input: QuoteInputSchema,
  photoCount: z.number().int().min(0).max(6),
});
export type QuoteRequestBody = z.infer<typeof QuoteRequestBody>;

export const QuoteRequestRecord = QuoteRequestBody.extend({
  ref: z.string().regex(REF_PATTERN),
  createdAt: z.string(),
  quoteLow: z.number(),
  quoteHigh: z.number(),
  needsSiteVisit: z.boolean(),
});
export type QuoteRequestRecord = z.infer<typeof QuoteRequestRecord>;

export function newRef(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `RTC-W${[...bytes].map((b) => chars[b % chars.length]).join("")}`;
}

export function buildRecord(body: QuoteRequestBody, now = new Date()): QuoteRequestRecord {
  const q = estimateQuote(body.input);
  return { ...body, ref: newRef(), createdAt: now.toISOString(), quoteLow: q.low, quoteHigh: q.high, needsSiteVisit: q.needsSiteVisit };
}

/** The dashboard's row for a request. */
export function toLead(r: QuoteRequestRecord): Lead {
  return {
    id: r.ref,
    createdAt: r.createdAt.slice(0, 10),
    name: r.contact.name,
    neighborhood: r.contact.neighborhood || "Not given",
    service: primaryService(r.input.services),
    services: r.input.services,
    source: r.input.emergency ? "Storm line" : "Instant quote",
    quoteLow: r.quoteLow,
    quoteHigh: r.quoteHigh,
    status: "new",
    jobValue: null,
    crew: null,
    crewDays: null,
  };
}

export async function saveQuoteRequest(r: QuoteRequestRecord): Promise<void> {
  await put(`${ROOT}${r.ref}.json`, JSON.stringify(r), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: false,
  });
}

async function readQuoteRequest(pathname: string): Promise<QuoteRequestRecord | null> {
  const res = await get(pathname, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return null;
  return QuoteRequestRecord.parse(JSON.parse(await new Response(res.stream).text()));
}

/** Most recent requests first. */
export async function listQuoteRequests(limit = 50): Promise<QuoteRequestRecord[]> {
  const paths: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: ROOT, cursor, limit: 1000 });
    paths.push(...page.blobs.map((b) => b.pathname).filter((p) => REF_PATTERN.test(p.slice(ROOT.length, -".json".length))));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const records: QuoteRequestRecord[] = [];
  const BATCH = 10;
  for (let i = 0; i < paths.length; i += BATCH) {
    const batch = await Promise.all(paths.slice(i, i + BATCH).map((p) => readQuoteRequest(p).catch(() => null)));
    for (const r of batch) if (r) records.push(r);
  }
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
