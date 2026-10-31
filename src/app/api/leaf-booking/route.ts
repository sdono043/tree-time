import { NextResponse } from "next/server";
import {
  storageConfigured,
  saveBooking,
  listBookingsForDate,
  LeafBookingInputSchema,
  type LeafBooking,
} from "@/lib/leaf-booking-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_SET_UP = { error: "Booking storage not configured yet." };

function isLeafSeason(dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00");
  const m = d.getUTCMonth() + 1; // 1-12
  return m >= 10 || m <= 1;
}

/** Public: returns booked timeSlots for a given date (no sensitive data). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }
  if (!storageConfigured()) return NextResponse.json({ slots: [] });
  try {
    const bookings = await listBookingsForDate(date);
    return NextResponse.json({ slots: bookings.map((b) => b.timeSlot) });
  } catch {
    return NextResponse.json({ slots: [] });
  }
}

/** Public: submit a leaf pickup booking. */
export async function POST(req: Request) {
  if (!storageConfigured()) return NextResponse.json(NOT_SET_UP, { status: 503 });
  const raw = await req.json().catch(() => null);
  const parsed = LeafBookingInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check your submission." }, { status: 400 });
  }
  const input = parsed.data;

  if (!isLeafSeason(input.date)) {
    return NextResponse.json({ error: "Leaf pickup is only available October–January." }, { status: 400 });
  }

  // Conflict check
  const existing = await listBookingsForDate(input.date);
  if (existing.some((b) => b.timeSlot === input.timeSlot)) {
    return NextResponse.json({ error: "That time slot was just taken — please choose another." }, { status: 409 });
  }

  const booking: LeafBooking = {
    id: crypto.randomUUID(),
    ...input,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await saveBooking(booking);
  return NextResponse.json({ ok: true, id: booking.id }, { status: 201 });
}
