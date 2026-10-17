import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { JobAssessment } from "@/lib/assessment";
import { ASSESS_SYSTEM_PROMPT } from "@/lib/assess-prompt";
import { Customer, EMPTY_CUSTOMER, Options, snapshotQuote, type EstimateRecord } from "@/lib/estimate-record";
import { savePhoto, saveRecord, storageConfigured } from "@/lib/estimate-store";
import { requireGm } from "@/lib/gm-auth";
import { DEFAULT_OPTIONS } from "@/lib/job-estimator";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_PHOTOS = 6;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const error = (status: number, message: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error: message, ...extra }, { status });

function parseJson<T>(value: FormDataEntryValue | null, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }): T | null {
  if (typeof value !== "string") return null;
  try {
    const r = schema.safeParse(JSON.parse(value));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // Both settings are required so a public deployment can't be used to spend API credit.
  if (!process.env.ANTHROPIC_API_KEY || !process.env.GM_ACCESS_CODE) {
    return error(503, "Photo analysis isn't set up on this deployment yet. Load a sample job to try the estimator.", { demo: true });
  }
  const denied = requireGm(req);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error(400, "Expected a multipart form upload.");
  }

  const photos = form.getAll("photos").filter((p): p is File => p instanceof File);
  if (photos.length === 0) return error(400, "Add at least one photo.");
  if (photos.length > MAX_PHOTOS) return error(400, `Up to ${MAX_PHOTOS} photos per job.`);
  if (photos.some((p) => !IMAGE_TYPES.includes(p.type as ImageType))) return error(400, "Photos must be JPEG, PNG, WebP or GIF.");
  if (photos.reduce((a, p) => a + p.size, 0) > MAX_TOTAL_BYTES) return error(413, "Photos are too large in total; use fewer or smaller photos.");

  const notes = String(form.get("notes") ?? "").slice(0, 2000);
  const options = parseJson(form.get("options"), Options) ?? DEFAULT_OPTIONS;
  const customer = parseJson(form.get("customer"), Customer) ?? EMPTY_CUSTOMER;
  const service = options.service;

  const images = await Promise.all(
    photos.map(async (p) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: p.type as ImageType, data: Buffer.from(await p.arrayBuffer()).toString("base64") },
    })),
  );

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: betaZodOutputFormat(JobAssessment) },
      system: ASSESS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...images,
            {
              type: "text",
              text: `Requested work: ${service}.\nManager's notes: ${notes || "(none)"}\n\nAssess the job shown in these ${images.length} photo(s).`,
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return error(422, "The model declined to assess these photos. Try different photos or enter the details by hand.");
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return error(502, "The assessment came back incomplete. Try again.");
    }
    const assessment = response.parsed_output;
    let saved: { id: string } | { error: string } | null = null;
    if (storageConfigured()) {
      // Save the analysis right away so a paid-for read is never lost to a closed tab.
      try {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const stored = await Promise.all(photos.map((p, i) => savePhoto(id, i, p)));
        const record: EstimateRecord = {
          id,
          createdAt: now,
          updatedAt: now,
          customer,
          notes,
          options,
          aiAssessment: assessment,
          assessment,
          quote: snapshotQuote(assessment, options),
          status: "draft",
          finalPrice: null,
          photos: stored,
          model: response.model,
        };
        await saveRecord(record);
        saved = { id };
      } catch (e) {
        console.error("assess: saving estimate failed", e);
        saved = { error: "The analysis worked but couldn't be saved to estimate history. Copy what you need before leaving the page." };
      }
    }
    return NextResponse.json({
      assessment,
      model: response.model,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      saved,
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return error(503, "The Anthropic API key on this deployment is invalid.");
    if (e instanceof Anthropic.RateLimitError) return error(429, "Rate limited by the Anthropic API. Wait a minute and retry.");
    if (e instanceof Anthropic.BadRequestError) return error(400, `The API rejected the request: ${e.message}`);
    if (e instanceof Anthropic.APIError) return error(502, `Anthropic API error (${e.status ?? "network"}). Try again.`);
    // Anything else is a response that didn't match the assessment schema.
    console.error("assess: unreadable assessment", e);
    return error(502, "The assessment came back in an unexpected shape. Try again.");
  }
}
