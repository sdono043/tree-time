import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_JOBS } from "@/lib/sample-jobs";
import { blobModule, blobs } from "@/test/blob-mock";

vi.mock("@vercel/blob", () => blobModule);

const parse = vi.fn();
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class MockAnthropic extends mod.default {
    beta = { messages: { parse } } as unknown as InstanceType<typeof mod.default>["beta"];
  }
  return { ...mod, default: MockAnthropic };
});

const { POST } = await import("./route");

function request({ code = "secret", photos = 1, type = "image/jpeg" } = {}) {
  const form = new FormData();
  for (let i = 0; i < photos; i++) form.append("photos", new File([new Uint8Array([1, 2, 3])], `p${i}.jpg`, { type }));
  form.append("options", JSON.stringify({ service: "trim", locality: "Henrico", grindStumps: false, haulDebris: true, historicDistrict: false }));
  form.append("customer", JSON.stringify({ name: "Pat Lee", phone: "", email: "", address: "12 Grove Ave" }));
  form.append("notes", "Gate is 4 ft wide");
  return new Request("http://localhost/api/assess", { method: "POST", body: form, headers: { "x-gm-access-code": code } });
}

describe("POST /api/assess", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.GM_ACCESS_CODE = "secret";
    parse.mockReset();
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GM_ACCESS_CODE;
  });

  it("reports demo mode when the key or access code isn't configured", async () => {
    delete process.env.GM_ACCESS_CODE;
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect((await res.json()).demo).toBe(true);
    expect(parse).not.toHaveBeenCalled();
  });

  it("rejects a wrong access code before calling the API", async () => {
    const res = await POST(request({ code: "nope" }));
    expect(res.status).toBe(401);
    expect(parse).not.toHaveBeenCalled();
  });

  it("validates the upload", async () => {
    expect((await POST(request({ photos: 0 }))).status).toBe(400);
    expect((await POST(request({ photos: 7 }))).status).toBe(400);
    expect((await POST(request({ type: "application/pdf" }))).status).toBe(400);
  });

  it("sends the photos to Claude with the schema and returns the assessment", async () => {
    const assessment = SAMPLE_JOBS[1].assessment;
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: assessment, model: "claude-opus-5-5", usage: { input_tokens: 3000, output_tokens: 900 } });
    const res = await POST(request({ photos: 2 }));
    expect(res.status).toBe(200);
    expect((await res.json()).assessment).toEqual(assessment);

    const params = parse.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.output_config.format).toBeDefined();
    const content = params.messages[0].content;
    expect(content.filter((b: { type: string }) => b.type === "image")).toHaveLength(2);
    expect(content.at(-1).text).toContain("Gate is 4 ft wide");
    expect(content.at(-1).text).toContain("Requested work: trim");
  });

  it("saves the analysis and photos when a blob store is connected", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test";
    blobs.clear();
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: SAMPLE_JOBS[0].assessment, model: "claude-opus-5-5", usage: { input_tokens: 1, output_tokens: 1 } });
    const body = await (await POST(request({ photos: 2 }))).json();
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect(body.saved.id).toMatch(/^[0-9a-f-]{36}$/);
    const record = JSON.parse(new TextDecoder().decode(blobs.get(`estimates/${body.saved.id}/record.json`)!.body));
    expect(record).toMatchObject({ status: "draft", customer: { name: "Pat Lee" }, options: { service: "trim", locality: "Henrico" } });
    expect(record.photos).toHaveLength(2);
    expect(blobs.has(`estimates/${body.saved.id}/photo-2.jpg`)).toBe(true);
  });

  it("still returns the analysis if saving fails", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test";
    blobModule.put.mockRejectedValueOnce(new Error("store down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: SAMPLE_JOBS[0].assessment, model: "claude-opus-5-5", usage: { input_tokens: 1, output_tokens: 1 } });
    const res = await POST(request());
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assessment).toBeDefined();
    expect(body.saved.error).toBeDefined();
  });

  it("handles refusals and unreadable output", async () => {
    parse.mockResolvedValueOnce({ stop_reason: "refusal", parsed_output: null, usage: {} });
    expect((await POST(request())).status).toBe(422);
    parse.mockRejectedValueOnce(new SyntaxError("bad json"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(request())).status).toBe(502);
  });
});
