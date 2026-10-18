import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blobModule, blobs } from "@/test/blob-mock";
import { DEFAULT_INPUT, estimateQuote } from "@/lib/pricing";

vi.mock("@vercel/blob", () => blobModule);

const { GET, POST } = await import("./route");

const body = {
  contact: { name: "Pat Lee", phone: "804-555-0101", email: "", address: "12 Grove Ave", neighborhood: "The Fan", window: "Any weekday" },
  input: { ...DEFAULT_INPUT, services: ["removal", "stump"], stumps: 1 },
  photoCount: 0,
};
const post = (b: unknown) => new Request("http://localhost/api/leads", { method: "POST", body: JSON.stringify(b) });
const get = (code = "secret") => new Request("http://localhost/api/leads", { headers: { "x-gm-access-code": code } });

describe("quote requests API", () => {
  beforeEach(() => {
    process.env.GM_ACCESS_CODE = "secret";
    process.env.BLOB_READ_WRITE_TOKEN = "test";
    blobs.clear();
  });
  afterEach(() => {
    delete process.env.GM_ACCESS_CODE;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("saves a request and lists it for the GM on any device", async () => {
    const res = await POST(post(body));
    expect(res.status).toBe(201);
    const { lead } = await res.json();
    expect(lead.id).toMatch(/^RTC-W[0-9A-Z]{6}$/);
    expect(lead.services).toEqual(["removal", "stump"]);

    const list = await (await GET(get())).json();
    expect(list.leads.map((l: { id: string }) => l.id)).toEqual([lead.id]);
    expect(list.requests[0].contact.phone).toBe("804-555-0101");
  });

  it("recomputes the price on the server", async () => {
    const res = await POST(post({ ...body, quoteLow: 1, quoteHigh: 2 }));
    const { lead } = await res.json();
    const q = estimateQuote(body.input as typeof DEFAULT_INPUT);
    expect([lead.quoteLow, lead.quoteHigh]).toEqual([q.low, q.high]);
  });

  it("rejects incomplete requests", async () => {
    const res = await POST(post({ ...body, contact: { ...body.contact, phone: "" } }));
    expect(res.status).toBe(400);
    expect(blobs.size).toBe(0);
  });

  it("keeps contact details behind the GM access code", async () => {
    expect((await GET(get("wrong"))).status).toBe(401);
  });

  it("reports when no store is connected so the page can fall back", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect((await POST(post(body))).status).toBe(503);
  });
});
