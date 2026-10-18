"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckGroup, OptionGroup } from "./OptionGroup";
import {
  DEFAULT_INPUT,
  estimateQuote,
  primaryService,
  SIZE_LABELS,
  type Access,
  type Cleanup,
  type QuoteInput,
  type Road,
  type Service,
  type StumpSize,
  type Target,
  type TreeSize,
} from "@/lib/pricing";
import { usd } from "@/lib/format";
import { saveLocalLead } from "@/lib/leads-store";
import type { Lead } from "@/lib/sample-data";

interface Photo {
  id: string;
  name: string;
  url: string;
}

const MAX_PHOTOS = 6;

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div>
      <span className="text-sm font-medium block mb-2">{label}</span>
      <div className="inline-flex items-center rounded-lg border border-line bg-surface">
        <button type="button" aria-label={`Fewer: ${label}`} className="px-3 py-2 text-lg disabled:opacity-40" disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <span className="w-10 text-center tabular" aria-live="polite">{value}</span>
        <button type="button" aria-label={`More: ${label}`} className="px-3 py-2 text-lg disabled:opacity-40" disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

export function QuoteEstimator() {
  const [input, setInput] = useState<QuoteInput>(DEFAULT_INPUT);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [submitted, setSubmitted] = useState<{ id: string; where: "server" | "browser" | "nowhere"; siteVisit: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const estimate = useMemo(() => estimateQuote(input), [input]);
  const set = <K extends keyof QuoteInput>(k: K, v: QuoteInput[K]) => setInput((p) => ({ ...p, [k]: v }));

  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const next = [...files]
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, room)
      .map((f) => ({ id: `${f.name}-${f.size}-${f.lastModified}`, name: f.name, url: URL.createObjectURL(f) }));
    setPhotos((p) => [...p, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removePhoto(id: string) {
    setPhotos((p) => {
      const gone = p.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return p.filter((x) => x.id !== id);
    });
  }

  function setServices(next: Service[]) {
    if (next.length === 0) return; // at least one service stays selected
    setInput((p) => {
      const addingStumps = next.includes("stump") && !p.services.includes("stump");
      // Grinding alongside a removal usually means those trees' stumps.
      const stumps = addingStumps ? Math.max(1, p.stumps, next.includes("removal") ? p.removeCount : 0) : p.stumps;
      return { ...p, services: next, stumps };
    });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const field = (k: string) => String(form.get(k) ?? "").trim();
    const contact = {
      name: field("name"),
      phone: field("phone"),
      email: field("email"),
      address: field("address"),
      neighborhood: field("neighborhood"),
      window: field("window"),
    };
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contact, input, photoCount: photos.length }),
      });
      if (res.ok) {
        const { lead } = (await res.json()) as { lead: Lead };
        setSubmitted({ id: lead.id, where: "server", siteVisit: estimate.needsSiteVisit });
        return;
      }
      if (res.status !== 503) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Something went wrong. Please try again or call us.");
        return;
      }
      // 503: no store connected on this deployment, so keep the request in this browser instead.
    } catch {
      // offline or server unreachable: same fallback
    } finally {
      setSending(false);
    }
    const id = `RTC-W${Date.now().toString(36).slice(-6).toUpperCase()}`;
    const saved = saveLocalLead({
      id,
      createdAt: new Date().toISOString().slice(0, 10),
      name: contact.name,
      neighborhood: contact.neighborhood || "Not given",
      service: primaryService(input.services),
      services: input.services,
      source: input.emergency ? "Storm line" : "Instant quote",
      quoteLow: estimate.low,
      quoteHigh: estimate.high,
      status: "new",
      jobValue: null,
      crew: null,
      crewDays: null,
    });
    setSubmitted({ id, where: saved ? "browser" : "nowhere", siteVisit: estimate.needsSiteVisit });
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-sm font-medium text-brand">Request received</p>
        <h2 className="mt-2 text-2xl font-semibold">We&apos;ll call you within one business day</h2>
        <p className="mt-3 text-ink-2">
          Reference <span className="font-mono">{submitted.id}</span>. Your estimate was{" "}
          <strong className="tabular">{usd(estimate.low)}–{usd(estimate.high)}</strong>.{" "}
          {submitted.siteVisit
            ? "This job needs a quick look in person, so we'll set a time for a free site visit."
            : "We'll go over the details with you and set up a free site visit if anything needs a closer look."}{" "}
          You&apos;ll get a firm price in writing. No work is scheduled until you approve it.
        </p>
        {submitted.where === "server" && (
          <p className="mt-6 text-sm text-muted">
            Demo: this request now appears under “Recent quote requests” on the{" "}
            <Link href="/dashboard" className="underline text-ink">owner dashboard</Link> (GM access code required).
          </p>
        )}
        {submitted.where === "browser" && (
          <p className="mt-6 text-sm text-muted">
            Demo: no request store is connected, so this request was kept in this browser only and shows on the{" "}
            <Link href="/dashboard" className="underline text-ink">owner dashboard</Link> here.
          </p>
        )}
        {submitted.where === "nowhere" && (
          <p className="mt-6 text-sm text-muted">Demo: no request store is connected and this browser blocks local storage, so the request wasn&apos;t saved.</p>
        )}
        <button
          type="button"
          className="mt-6 rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface-2"
          onClick={() => {
            setSubmitted(null);
            setInput(DEFAULT_INPUT);
            photos.forEach((p) => URL.revokeObjectURL(p.url));
            setPhotos([]);
          }}
        >
          Start another estimate
        </button>
      </div>
    );
  }

  const has = (sv: Service) => input.services.includes(sv);
  const showTreeFields = has("trim") || has("removal");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] items-start">
      <div className="space-y-7">
        <CheckGroup<Service>
          legend="What do you need?"
          hint="Pick all that apply"
          values={input.services}
          onChange={setServices}
          options={[
            { value: "trim", label: "Trimming / pruning", hint: "Deadwood, clearance, shaping" },
            { value: "removal", label: "Tree removal", hint: "Take the whole tree down" },
            { value: "stump", label: "Stump grinding", hint: "New or existing stumps" },
          ]}
        />

        {showTreeFields && (
          <>
            <div className="flex flex-wrap gap-8">
              {has("removal") && (
                <Stepper label="Trees to remove" value={input.removeCount} min={1} max={10} onChange={(n) => set("removeCount", n)} />
              )}
              {has("trim") && (
                <Stepper label="Trees to trim" value={input.trimCount} min={1} max={10} onChange={(n) => set("trimCount", n)} />
              )}
            </div>
            <OptionGroup<TreeSize>
              legend="Height of the largest tree"
              name="size"
              value={input.size}
              onChange={(v) => set("size", v)}
              columns={4}
              options={[
                { value: "small", label: SIZE_LABELS.small, hint: "Up to a 2-story roof" },
                { value: "medium", label: SIZE_LABELS.medium, hint: "Above the roofline" },
                { value: "large", label: SIZE_LABELS.large, hint: "Mature oak, tulip poplar" },
                { value: "xl", label: SIZE_LABELS.xl, hint: "Towering, landmark" },
              ]}
            />
            <OptionGroup<Access>
              legend="Can a truck get close?"
              name="access"
              value={input.access}
              onChange={(v) => set("access", v)}
              options={[
                { value: "open", label: "Yes, easy access", hint: "Front yard or driveway" },
                { value: "backyard", label: "Backyard, through a gate", hint: "Carry brush to the street" },
                { value: "tight", label: "Tight or steep", hint: "No equipment access, slope" },
              ]}
            />
            <CheckGroup<Target>
              legend="What could it hit?"
              hint="Pick any, or none if it's in open space"
              values={input.targets}
              onChange={(v) => set("targets", v)}
              options={[
                { value: "structure", label: "House, fence or car", hint: "Needs rigging / lowering" },
                { value: "powerline", label: "Power lines", hint: "Lines in or near the canopy" },
              ]}
            />
            <OptionGroup<Road>
              legend="How close is the street or sidewalk?"
              name="road"
              value={input.road}
              onChange={(v) => set("road", v)}
              options={[
                { value: "none", label: "Not near it", hint: "Work stays on the property" },
                { value: "overhang", label: "Branches hang over it", hint: "Street or sidewalk below" },
                { value: "close", label: "Trunk within 10 ft", hint: "Of the curb or sidewalk" },
              ]}
            />
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={input.deadOrLeaning} onChange={(e) => set("deadOrLeaning", e.target.checked)} />
              The tree is dead, cracked or leaning
            </label>
          </>
        )}

        {has("stump") && (
          <div className="flex flex-wrap gap-8 items-start">
            <Stepper label="Stumps to grind" value={input.stumps} min={1} max={10} onChange={(n) => set("stumps", n)} />
            <div className="flex-1 min-w-64">
              <OptionGroup<StumpSize>
                legend="Typical stump width"
                name="stumpSize"
                value={input.stumpSize}
                onChange={(v) => set("stumpSize", v)}
                options={[
                  { value: "small", label: "Under 12 in" },
                  { value: "medium", label: "12–24 in" },
                  { value: "large", label: "Over 24 in" },
                ]}
              />
            </div>
          </div>
        )}

        {showTreeFields && (
          <OptionGroup<Cleanup>
            legend="Cleanup"
            name="cleanup"
            value={input.cleanup}
            onChange={(v) => set("cleanup", v)}
            options={[
              { value: "full", label: "Haul everything away" },
              { value: "leave-wood", label: "Leave firewood rounds", hint: "Save about 10%" },
              { value: "none", label: "Leave it all on-site", hint: "Save about 20%" },
            ]}
          />
        )}

        <label className="flex items-start gap-3 rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--warn)]" checked={input.emergency} onChange={(e) => set("emergency", e.target.checked)} />
          <span>
            <span className="font-medium">This is storm damage or an emergency</span>
            <span className="block text-ink-2">A tree is on a structure, a car or blocking access. We triage these first.</span>
          </span>
        </label>

        <div>
          <span className="text-sm font-medium block mb-2">Photos (optional, up to {MAX_PHOTOS})</span>
          <p className="text-xs text-muted mb-3">A wide shot of the whole tree and one of what&apos;s around it help us confirm your price without a visit.</p>
          <div className="flex flex-wrap gap-3">
            {photos.map((p) => (
              <div key={p.id} className="relative size-24 overflow-hidden rounded-lg border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img src={p.url} alt={p.name} className="size-full object-cover" />
                <button type="button" onClick={() => removePhoto(p.id)} aria-label={`Remove ${p.name}`} className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">✕</button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="flex size-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface text-xs text-muted hover:bg-surface-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand">
                <span className="text-xl leading-none">+</span>
                Add photos
                <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
              </label>
            )}
          </div>
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 space-y-4">
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">Your estimate</p>
          <p className="mt-1 text-3xl font-semibold tabular" aria-live="polite">
            {usd(estimate.low)} – {usd(estimate.high)}
          </p>
          <ul className="mt-4 space-y-1.5 text-sm">
            {estimate.lineItems.map((l) => (
              <li key={l.label} className="flex justify-between gap-3">
                <span className="text-ink-2">{l.label}</span>
                <span className="tabular whitespace-nowrap">{usd(l.low)}–{usd(l.high)}</span>
              </li>
            ))}
          </ul>
          {estimate.needsSiteVisit && (
            <p className="mt-4 rounded-md bg-warn-soft px-3 py-2 text-xs text-ink">
              <strong>Site visit needed.</strong> We&apos;ll confirm this one in person before committing to a price.
            </p>
          )}
          <ul className="mt-4 space-y-1 text-xs text-muted list-disc pl-4">
            {estimate.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </div>

        <form onSubmit={submit} className="rounded-xl border border-line bg-surface p-5 space-y-3">
          <h2 className="font-semibold">{estimate.needsSiteVisit ? "Book a free site visit" : "Get a firm quote"}</h2>
          <p className="text-xs text-ink-2">
            This is a request for a firm written price, not a booking. We&apos;ll call within one business day
            {estimate.needsSiteVisit ? " to set a time to see the tree" : " and visit if anything needs a closer look"}. No work is
            scheduled until you approve the price.
          </p>
          {[
            { name: "name", label: "Name", type: "text", autoComplete: "name", required: true },
            { name: "phone", label: "Phone", type: "tel", autoComplete: "tel", required: true },
            { name: "email", label: "Email", type: "email", autoComplete: "email", required: false },
            { name: "address", label: "Street address", type: "text", autoComplete: "street-address", required: true },
            { name: "neighborhood", label: "Neighborhood (optional)", type: "text", autoComplete: "off", required: false },
          ].map((f) => (
            <label key={f.name} className="block text-sm">
              <span className="text-ink-2">{f.label}</span>
              <input
                name={f.name}
                type={f.type}
                required={f.required}
                autoComplete={f.autoComplete}
                className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 focus:outline-2 focus:outline-brand"
              />
            </label>
          ))}
          <label className="block text-sm">
            <span className="text-ink-2">Best time to reach you</span>
            <select name="window" className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2">
              <option>Any weekday</option>
              <option>Weekday mornings</option>
              <option>Weekday afternoons</option>
              <option>Saturday</option>
            </select>
          </label>
          {error && <p className="text-sm text-bad" role="alert">{error}</p>}
          <button type="submit" disabled={sending} className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-on-brand hover:bg-brand-strong disabled:opacity-60">
            {sending ? "Sending…" : input.emergency ? "Send emergency request" : estimate.needsSiteVisit ? "Request my free visit" : "Request my firm quote"}
          </button>
          <p className="text-xs text-muted">Demo site: requests are saved for the Richmond Tree Care team to review. Photos stay on your device for now.</p>
        </form>
      </aside>
    </div>
  );
}
