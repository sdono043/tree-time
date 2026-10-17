// Server-only persistence for estimates in a private Vercel Blob store:
//   estimates/<id>/record.json
//   estimates/<id>/photo-<n>.jpg
import { get, list, put } from "@vercel/blob";
import { EstimateRecord } from "./estimate-record";

const ROOT = "estimates/";
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const isValidId = (id: string) => ID_PATTERN.test(id);
export const storageConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

const recordPath = (id: string) => `${ROOT}${id}/record.json`;

export async function savePhoto(id: string, index: number, file: File): Promise<{ pathname: string; contentType: string }> {
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
  const pathname = `${ROOT}${id}/photo-${index + 1}.${ext}`;
  await put(pathname, file, { access: "private", contentType: file.type, addRandomSuffix: false, allowOverwrite: true });
  return { pathname, contentType: file.type };
}

export async function saveRecord(record: EstimateRecord): Promise<void> {
  await put(recordPath(record.id), JSON.stringify(record), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

export async function readRecord(id: string): Promise<EstimateRecord | null> {
  if (!isValidId(id)) return null;
  const res = await get(recordPath(id), { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return null;
  const text = await new Response(res.stream).text();
  return EstimateRecord.parse(JSON.parse(text));
}

/** Every saved estimate, newest first. Fine for the hundreds-per-year this business will create. */
export async function listRecords(): Promise<EstimateRecord[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: ROOT, cursor, limit: 1000 });
    for (const b of page.blobs) {
      const m = b.pathname.match(/^estimates\/([^/]+)\/record\.json$/);
      if (m && isValidId(m[1])) ids.push(m[1]);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const records: EstimateRecord[] = [];
  const BATCH = 10;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = await Promise.all(ids.slice(i, i + BATCH).map((id) => readRecord(id).catch(() => null)));
    for (const r of batch) if (r) records.push(r);
  }
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function readPhoto(record: EstimateRecord, index: number) {
  const photo = record.photos[index];
  if (!photo) return null;
  const res = await get(photo.pathname, { access: "private" });
  if (!res || res.statusCode !== 200) return null;
  return { stream: res.stream, contentType: photo.contentType };
}
