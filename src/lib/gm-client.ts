// Browser helpers for GM-only pages: remembers the access code for the tab
// session and attaches it to API calls.
const CODE_KEY = "rtc-gm-access-code";

export function loadAccessCode(): string {
  try {
    return window.sessionStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberAccessCode(code: string) {
  try {
    window.sessionStorage.setItem(CODE_KEY, code);
  } catch {
    // storage blocked; the code just isn't remembered
  }
}

/** fetch() with the GM access code attached; resolves to the parsed JSON body or throws with the server's message. */
export async function gmFetch<T>(url: string, code: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...init.headers, "x-gm-access-code": code } });
  const body = await res.json().catch(() => ({ error: `Server error (${res.status}).` }));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  return body as T;
}

/** Loads a private estimate photo as an object URL (img tags can't send the access header). */
export async function gmPhotoUrl(url: string, code: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "x-gm-access-code": code } });
    return res.ok ? URL.createObjectURL(await res.blob()) : null;
  } catch {
    return null;
  }
}
