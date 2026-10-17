// In-memory stand-in for @vercel/blob used by route and store tests.
import { vi } from "vitest";

export const blobs = new Map<string, { body: Uint8Array; contentType: string }>();

async function toBytes(body: unknown): Promise<Uint8Array> {
  if (typeof body === "string") return new TextEncoder().encode(body);
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  throw new Error("unsupported body");
}

export const blobModule = {
  put: vi.fn(async (pathname: string, body: unknown, opts: { contentType?: string; access: string }) => {
    if (opts.access !== "private") throw new Error("expected private access");
    blobs.set(pathname, { body: await toBytes(body), contentType: opts.contentType ?? "application/octet-stream" });
    return { pathname, url: `https://store.private.blob.vercel-storage.com/${pathname}` };
  }),
  get: vi.fn(async (pathname: string) => {
    const b = blobs.get(pathname);
    if (!b) return null;
    return { statusCode: 200, stream: new Blob([b.body as BlobPart]).stream(), headers: new Headers(), blob: { contentType: b.contentType, size: b.body.length } };
  }),
  list: vi.fn(async ({ prefix }: { prefix: string }) => ({
    blobs: [...blobs.keys()].filter((k) => k.startsWith(prefix)).map((pathname) => ({ pathname, url: pathname })),
    hasMore: false,
    cursor: undefined,
  })),
};
