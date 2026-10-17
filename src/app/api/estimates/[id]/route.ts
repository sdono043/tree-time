import { NextResponse } from "next/server";
import { applyPatch, EstimatePatch } from "@/lib/estimate-record";
import { readRecord, saveRecord, storageConfigured } from "@/lib/estimate-store";
import { requireGm } from "@/lib/gm-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const notConfigured = () =>
  NextResponse.json({ error: "Saved estimates aren't set up yet (no Vercel Blob store connected).", demo: true }, { status: 503 });

export async function GET(req: Request, { params }: Ctx) {
  const denied = requireGm(req);
  if (denied) return denied;
  if (!storageConfigured()) return notConfigured();
  const record = await readRecord((await params).id);
  if (!record) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  return NextResponse.json({ estimate: record });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = requireGm(req);
  if (denied) return denied;
  if (!storageConfigured()) return notConfigured();
  const record = await readRecord((await params).id);
  if (!record) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });

  const parsed = EstimatePatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });

  const next = applyPatch(record, parsed.data);
  await saveRecord(next);
  return NextResponse.json({ estimate: next });
}
