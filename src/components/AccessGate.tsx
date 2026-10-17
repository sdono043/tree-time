"use client";

import { useState } from "react";

/** Prompt for the GM access code when a page has none or the server rejected it. */
export function AccessGate({ message, onSubmit }: { message?: string; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(code);
      }}
      className="mx-auto max-w-sm rounded-xl border border-line bg-surface p-6 space-y-3"
    >
      <h2 className="font-semibold">GM access code</h2>
      {message && <p className="text-sm text-ink-2" role="alert">{message}</p>}
      <input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoFocus className="w-full rounded-md border border-line bg-bg px-3 py-2" />
      <button type="submit" className="w-full rounded-lg bg-brand px-4 py-2 font-medium text-on-brand hover:bg-brand-strong">Continue</button>
    </form>
  );
}
