import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blobModule, blobs } from "@/test/blob-mock";
import { SAMPLE_JOBS } from "@/lib/sample-jobs";
import { DEFAULT_OPTIONS } from "@/lib/job-estimator";
import { snapshotQuote, type EstimateRecord } from "@/lib/estimate-record";
import { saveRecord } from "@/lib/estimate-store";

vi.mock("@vercel/blob", () => blobModule);

const { GET: listGET } = await import("./route");
const { GET, PATCH } = await import("./[id]/route");
const { GET: photoGET } = await import("./[id]/photos/[index]/route");

const ID = "11111111-2222-4333-8444-555555555555";
const job = SAMPLE_JOBS[1].assessment;
const record: EstimateRecord = {
  id: ID,
  createdAt: "2026-10-17T12:00:00.000Z",
  updatedAt: "2026-10-17T12:00:00.000Z",
  customer: { name: "Pat Lee", phone: "804-555-0101", email: "", address: "12 Grove Ave" },
  notes: "",
  options: DEFAULT_OPTIONS,
  aiAssessment: job,
  assessment: job,
  quote: snapshotQuote(job, DEFAULT_OPTIONS),
  status: "draft",
  finalPrice: null,
  photos: [{ pathname: `estimates/${ID}/photo-1.jpg`, contentType: "image/jpeg" }],
  model: "claude-opus-5-5",
};

const req = (url: string, init: RequestInit = {}, code = "secret") =>
  new Request(`http://localhost${url}`, { ...init, headers: { ...init.headers, "x-gm-access-code": code } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("estimates API", () => {
  beforeEach(async () => {
    process.env.GM_ACCESS_CODE = "secret";
    process.env.BLOB_READ_WRITE_TOKEN = "test";
    blobs.clear();
    await saveRecord(record);
    blobs.set(`estimates/${ID}/photo-1.jpg`, { body: new Uint8Array([9, 9, 9]), contentType: "image/jpeg" });
  });
  afterEach(() => {
    delete process.env.GM_ACCESS_CODE;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("requires the access code", async () => {
    expect((await listGET(req("/api/estimates", {}, "wrong"))).status).toBe(401);
    expect((await GET(req(`/api/estimates/${ID}`, {}, "wrong"), ctx(ID))).status).toBe(401);
  });

  it("reports when storage isn't connected", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const res = await listGET(req("/api/estimates"));
    expect(res.status).toBe(503);
  });

  it("lists summaries", async () => {
    const body = await (await listGET(req("/api/estimates"))).json();
    expect(body.estimates).toHaveLength(1);
    expect(body.estimates[0]).toMatchObject({ id: ID, customer: { name: "Pat Lee" }, photoCount: 1, edited: false });
  });

  it("rejects ids that aren't uuids", async () => {
    expect((await GET(req("/api/estimates/../x"), ctx("../x"))).status).toBe(404);
  });

  it("updates status and final price, and re-prices edited assessments on the server", async () => {
    const taller = { ...job, trees: [{ ...job.trees[0], heightFtLow: 80, heightFtHigh: 95 }] };
    const res = await PATCH(
      req(`/api/estimates/${ID}`, { method: "PATCH", body: JSON.stringify({ status: "won", finalPrice: 5200, assessment: taller }) }),
      ctx(ID),
    );
    expect(res.status).toBe(200);
    const { estimate } = await res.json();
    expect(estimate.status).toBe("won");
    expect(estimate.finalPrice).toBe(5200);
    expect(estimate.quote.priceHigh).toBeGreaterThan(record.quote.priceHigh);
    expect(estimate.aiAssessment).toEqual(job);

    const listed = await (await listGET(req("/api/estimates"))).json();
    expect(listed.estimates[0].edited).toBe(true);
  });

  it("rejects invalid updates", async () => {
    const res = await PATCH(req(`/api/estimates/${ID}`, { method: "PATCH", body: JSON.stringify({ status: "maybe" }) }), ctx(ID));
    expect(res.status).toBe(400);
  });

  it("streams private photos only with the code", async () => {
    const ok = await photoGET(req(`/api/estimates/${ID}/photos/1`), { params: Promise.resolve({ id: ID, index: "1" }) });
    expect(ok.status).toBe(200);
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(new Uint8Array([9, 9, 9]));
    expect((await photoGET(req(`/api/estimates/${ID}/photos/5`), { params: Promise.resolve({ id: ID, index: "5" }) })).status).toBe(404);
    expect((await photoGET(req(`/api/estimates/${ID}/photos/1`, {}, "nope"), { params: Promise.resolve({ id: ID, index: "1" }) })).status).toBe(401);
  });
});
