import { NextResponse } from "next/server";
import { readPhoto, readRecord, storageConfigured } from "@/lib/estimate-store";
import { requireGm } from "@/lib/gm-auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; index: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const denied = requireGm(req);
  if (denied) return denied;
  if (!storageConfigured()) return NextResponse.json({ error: "Storage not configured." }, { status: 503 });
  const { id, index } = await params;
  const record = await readRecord(id);
  const photo = record ? await readPhoto(record, Number(index) - 1) : null;
  if (!photo) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  return new Response(photo.stream, {
    headers: { "Content-Type": photo.contentType, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
