// Server-only: leaf pickup bookings stored in private Vercel Blob
//   leaf-bookings/<id>.json
import { list, get, put } from "@vercel/blob";
import { z } from "zod";
import { storageConfigured } from "./estimate-store";

export { storageConfigured };

const ROOT = "leaf-bookings/";

export const LeafBookingSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  date: z.string(), // YYYY-MM-DD
  timeSlot: z.string(), // e.g. "9:00 AM"
  lotSizeAcres: z.number(),
  estimatedCost: z.number(),
  status: z.enum(["pending", "confirmed", "cancelled"]),
  createdAt: z.string(),
});

export type LeafBooking = z.infer<typeof LeafBookingSchema>;

export const LeafBookingInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(50),
  address: z.string().trim().min(1).max(300),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.string().min(1).max(20),
  lotSizeAcres: z.number().min(0).max(100),
  estimatedCost: z.number().min(0),
});

export type LeafBookingInput = z.infer<typeof LeafBookingInputSchema>;

const path = (id: string) => `${ROOT}${id}.json`;

export async function saveBooking(booking: LeafBooking): Promise<void> {
  await put(path(booking.id), JSON.stringify(booking), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

export async function listBookingsForDate(date: string): Promise<LeafBooking[]> {
  const { blobs } = await list({ prefix: ROOT, mode: "expanded" });
  const results: LeafBooking[] = [];
  await Promise.all(
    blobs.map(async (b) => {
      try {
        const res = await get(b.pathname, { access: "private", useCache: false });
        if (!res || res.statusCode !== 200) return;
        const text = await new Response(res.stream).text();
        const booking = LeafBookingSchema.parse(JSON.parse(text));
        if (booking.date === date && booking.status !== "cancelled") {
          results.push(booking);
        }
      } catch {
        // skip corrupt entries
      }
    }),
  );
  return results;
}
