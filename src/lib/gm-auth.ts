import { NextResponse } from "next/server";

/**
 * Checks the GM access code header. Returns an error response to send back,
 * or null when the request may proceed.
 */
export function requireGm(req: Request): NextResponse | null {
  const accessCode = process.env.GM_ACCESS_CODE;
  if (!accessCode) {
    return NextResponse.json({ error: "GM tools aren't set up on this deployment yet (GM_ACCESS_CODE is missing).", demo: true }, { status: 503 });
  }
  if (req.headers.get("x-gm-access-code") !== accessCode) {
    return NextResponse.json({ error: "Wrong or missing GM access code." }, { status: 401 });
  }
  return null;
}
