// Shape of a saved estimate. Stored as JSON next to its photos in Vercel Blob.
import { z } from "zod";
import { JobAssessment } from "./assessment";
import { estimateJob, type JobOptions } from "./job-estimator";

export const EstimateStatus = z.enum(["draft", "sent", "won", "lost"]);
export type EstimateStatus = z.infer<typeof EstimateStatus>;

export const STATUS_LABELS: Record<EstimateStatus, string> = { draft: "Draft", sent: "Sent", won: "Won", lost: "Lost" };

export const Customer = z.object({
  name: z.string().max(200),
  phone: z.string().max(50),
  email: z.string().max(200),
  address: z.string().max(300),
});
export type Customer = z.infer<typeof Customer>;
export const EMPTY_CUSTOMER: Customer = { name: "", phone: "", email: "", address: "" };

export const Options = z.object({
  service: z.enum(["removal", "trim", "stump"]),
  locality: z.enum(["Richmond", "Henrico", "Chesterfield"]),
  grindStumps: z.boolean(),
  haulDebris: z.boolean(),
  historicDistrict: z.boolean(),
});

export const QuoteSnapshot = z.object({
  priceLow: z.number(),
  priceHigh: z.number(),
  costLow: z.number(),
  costHigh: z.number(),
  method: z.string(),
  flags: z.array(z.string()),
});
export type QuoteSnapshot = z.infer<typeof QuoteSnapshot>;

export const EstimateRecord = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  customer: Customer,
  notes: z.string(),
  options: Options,
  /** What the AI read from the photos, never edited. */
  aiAssessment: JobAssessment,
  /** The GM's current version (starts as a copy of aiAssessment). */
  assessment: JobAssessment,
  quote: QuoteSnapshot,
  status: EstimateStatus,
  finalPrice: z.number().nullable(),
  photos: z.array(z.object({ pathname: z.string(), contentType: z.string() })),
  model: z.string().nullable(),
});
export type EstimateRecord = z.infer<typeof EstimateRecord>;

/** Fields the GM can change after the estimate is created. */
export const EstimatePatch = z
  .object({
    customer: Customer,
    notes: z.string().max(2000),
    options: Options,
    assessment: JobAssessment,
    status: EstimateStatus,
    finalPrice: z.number().min(0).nullable(),
  })
  .partial();
export type EstimatePatch = z.infer<typeof EstimatePatch>;

export type EstimateSummary = Pick<EstimateRecord, "id" | "createdAt" | "updatedAt" | "customer" | "status" | "finalPrice" | "quote"> & {
  service: JobOptions["service"];
  locality: JobOptions["locality"];
  photoCount: number;
  edited: boolean;
};

export function snapshotQuote(assessment: JobAssessment, options: JobOptions): QuoteSnapshot {
  const e = estimateJob(assessment, options);
  return {
    priceLow: e.priceLow,
    priceHigh: e.priceHigh,
    costLow: e.costLow,
    costHigh: e.costHigh,
    method: e.method,
    flags: e.flags.filter((f) => f.level !== "info").map((f) => f.title),
  };
}

export function summarize(r: EstimateRecord): EstimateSummary {
  return {
    id: r.id,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    customer: r.customer,
    status: r.status,
    finalPrice: r.finalPrice,
    quote: r.quote,
    service: r.options.service,
    locality: r.options.locality,
    photoCount: r.photos.length,
    edited: JSON.stringify(r.aiAssessment) !== JSON.stringify(r.assessment),
  };
}

/** Applies a patch and re-prices on the server, so a saved quote always matches its assessment. */
export function applyPatch(r: EstimateRecord, patch: EstimatePatch, now = new Date()): EstimateRecord {
  const next: EstimateRecord = { ...r, ...patch, updatedAt: now.toISOString() };
  next.quote = snapshotQuote(next.assessment, next.options);
  return next;
}
