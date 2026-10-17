"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { OptionGroup } from "./OptionGroup";
import {
  DEFAULT_INPUT,
  estimateQuote,
  SIZE_LABELS,
  type Access,
  type Cleanup,
  type Hazard,
  type QuoteInput,
  type Service,
  type StumpSize,
  type TreeSize,
} from "@/lib/pricing";
import { usd } from "@/lib/format";
import { saveLocalLead } from "@/lib/leads-store";

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
  const [submitted, setSubmitted] = useState<{ id: string; saved: boolean } | null>(null);
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

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const id = `RTC-W${Date.now().toString().slice(-5)}`;
    const saved = saveLocalLead({
      id,
      createdAt: new Date().toISOString().slice(0, 10),
      name: String(form.get("name") ?? ""),
      neighborhood: String(form.get("neighborhood") ?? "") || "Not given",
      service: input.service,
      source: input.emergency ? "Storm line" : "Instant quote",
      quoteLow: estimate.low,
      quoteHigh: estimate.high,
      status: "new",
      jobValue: null,
      crew: null,
      crewDays: null,
    });
    setSubmitted({ id, saved });
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-sm font-medium text-brand">Request received</p>
        <h2 className="mt-2 text-2xl font-semibold">We&apos;ll confirm your visit within one business day</h2>
        <p className="mt-3 text-ink-2">
          Reference <span className="font-mono">{submitted.id}</span>. Your estimate was{" "}
          <strong className="tabular">{usd(estimate.low)}–{usd(estimate.high)}</strong>. The crew lead confirms the final
          price in writing before any work starts.
        </p>
        {submitted.saved ? (
          <p className="mt-6 text-sm text-muted">
            Demo: this request now appears under “Recent quote requests” on the{" "}
            <Link href="/dashboard" className="underline text-ink">owner dashboard</Link>.
          </p>
        ) : (
          <p className="mt-6 text-sm text-muted">Demo: this browser blocks local storage, so the request wasn&apos;t saved.</p>
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

  const showTreeFields = input.service !== "stump";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] items-start">
      <div className="space-y-7">
        <OptionGroup<Service>
          legend="What do you need?"
          name="service"
          value={input.service}
          onChange={(v) => setInput((p) => ({ ...p, service: v, stumps: v === "stump" ? Math.max(1, p.stumps) : p.stumps }))}
          options={[
            { value: "trim", label: "Trimming / pruning", hint: "Deadwood, clearance, shaping" },
            { value: "removal", label: "Tree removal", hint: "Take the whole tree down" },
            { value: "stump", label: "Stump grinding only", hint: "Existing stumps" },
          ]}
        />

        {showTreeFields && (
          <>
            <div className="flex flex-wrap gap-8">
              <Stepper label="Number of trees" value={input.treeCount} min={1} max={10} onChange={(n) => set("treeCount", n)} />
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
            <OptionGroup<Hazard>
              legend="What's nearby?"
              name="hazard"
              value={input.hazard}
              onChange={(v) => set("hazard", v)}
              options={[
                { value: "none", label: "Open space", hint: "Nothing it could hit" },
                { value: "structure", label: "House, fence or car", hint: "Needs rigging / lowering" },
                { value: "powerline", label: "Power lines", hint: "Lines in or near the canopy" },
              ]}
            />
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={input.deadOrLeaning} onChange={(e) => set("deadOrLeaning", e.target.checked)} />
              The tree is dead, cracked or leaning
            </label>
          </>
        )}

        <div className="flex flex-wrap gap-8 items-start">
          <Stepper label={showTreeFields ? "Stumps to grind" : "Number of stumps"} value={input.stumps} min={showTreeFields ? 0 : 1} max={10} onChange={(n) => set("stumps", n)} />
          {input.stumps > 0 && (
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
          )}
        </div>

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
          <h2 className="font-semibold">Request a visit at this price</h2>
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
            <span className="text-ink-2">Best time for us to come by</span>
            <select name="window" className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2">
              <option>Any weekday</option>
              <option>Weekday mornings</option>
              <option>Weekday afternoons</option>
              <option>Saturday</option>
            </select>
          </label>
          <button type="submit" className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-on-brand hover:bg-brand-strong">
            {input.emergency ? "Send emergency request" : "Request my visit"}
          </button>
          <p className="text-xs text-muted">Demo: nothing is sent; the request is kept in this browser only.</p>
        </form>
      </aside>
    </div>
  );
}
