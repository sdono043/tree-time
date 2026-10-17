import { NextResponse } from "next/server";
import { summarize } from "@/lib/estimate-record";
import { listRecords, storageConfigured } from "@/lib/estimate-store";
import { requireGm } from "@/lib/gm-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireGm(req);
  if (denied) return denied;
  if (!storageConfigured()) {
    return NextResponse.json({ error: "Saved estimates aren't set up yet (no Vercel Blob store connected).", demo: true }, { status: 503 });
  }
  const records = await listRecords();
  return NextResponse.json({ estimates: records.map(summarize) });
}
