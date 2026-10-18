import { NextResponse } from "next/server";
import { storageConfigured } from "@/lib/estimate-store";
import { requireGm } from "@/lib/gm-auth";
import { buildRecord, listQuoteRequests, QuoteRequestBody, saveQuoteRequest, toLead } from "@/lib/quote-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_SET_UP = { error: "Quote requests can't be saved yet (no Vercel Blob store connected).", demo: true };

/** Public: the /quote page submits here. */
export async function POST(req: Request) {
  if (!storageConfigured()) return NextResponse.json(NOT_SET_UP, { status: 503 });
  const raw = await req.json().catch(() => null);
  const parsed = QuoteRequestBody.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  const record = buildRecord(parsed.data);
  await saveQuoteRequest(record);
  return NextResponse.json({ lead: toLead(record), needsSiteVisit: record.needsSiteVisit }, { status: 201 });
}

/** GM only: customer names and contact details. */
export async function GET(req: Request) {
  const denied = requireGm(req);
  if (denied) return denied;
  if (!storageConfigured()) return NextResponse.json(NOT_SET_UP, { status: 503 });
  const records = await listQuoteRequests();
  return NextResponse.json({ leads: records.map(toLead), requests: records });
}
