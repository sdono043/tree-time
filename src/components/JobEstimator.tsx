"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { JobAssessment, TreeAssessment } from "@/lib/assessment";
import {
  DEFAULT_OPTIONS,
  estimateJob,
  METHOD_LABELS,
  type Flag,
  type FlagLevel,
  type JobOptions,
  type Locality,
  type Service,
} from "@/lib/job-estimator";
import { SAMPLE_JOBS } from "@/lib/sample-jobs";
import { usd } from "@/lib/format";
import { EMPTY_CUSTOMER, type Customer, type EstimateRecord } from "@/lib/estimate-record";
import { gmFetch, gmPhotoUrl, loadAccessCode, rememberAccessCode } from "@/lib/gm-client";

interface Photo {
  id: string;
  name: string;
  url: string;
  file: File;
}

const MAX_PHOTOS = 6;
const MAX_EDGE = 1568; // larger images are downscaled by the API anyway

/** Downscale to a JPEG so several phone photos fit in one request. */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

const FLAG_STYLE: Record<FlagLevel, { label: string; icon: string; cls: string }> = {
  stop: { label: "Stop", icon: "⛔", cls: "border-bad/50 bg-bad/10" },
  visit: { label: "Site visit", icon: "⚠", cls: "border-warn/50 bg-warn-soft" },
  check: { label: "Check", icon: "☐", cls: "border-line bg-surface-2" },
  info: { label: "Note", icon: "ℹ", cls: "border-line bg-surface" },
};

const TARGETS: { value: JobAssessment["targets"][number]; label: string }[] = [
  { value: "house", label: "House" },
  { value: "outbuilding", label: "Shed / garage" },
  { value: "fence", label: "Fence" },
  { value: "vehicle", label: "Vehicles" },
  { value: "road_or_sidewalk", label: "Road / sidewalk" },
  { value: "pool", label: "Pool" },
  { value: "landscaping", label: "Landscaping" },
  { value: "neighbor_property", label: "Neighbor's property" },
];

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  edited,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  edited?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-ink-2">
        {label}
        {edited && <EditedDot />}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="mt-1 w-full rounded-md border border-line bg-bg px-2 py-1.5">
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

function RangeInput({
  label,
  unit,
  low,
  high,
  onChange,
  edited,
}: {
  label: string;
  unit: string;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
  edited?: boolean;
}) {
  const num = (s: string) => Math.max(0, Number(s) || 0);
  return (
    <div className="text-sm">
      <span className="text-ink-2">
        {label}
        {edited && <EditedDot />}
      </span>
      <div className="mt-1 flex items-center gap-1.5">
        <input type="number" inputMode="numeric" aria-label={`${label} low`} value={low} onChange={(e) => onChange(num(e.target.value), Math.max(high, num(e.target.value)))} className="w-full min-w-0 rounded-md border border-line bg-bg px-2 py-1.5 tabular" />
        <span className="text-muted">–</span>
        <input type="number" inputMode="numeric" aria-label={`${label} high`} value={high} onChange={(e) => onChange(Math.min(low, num(e.target.value)), num(e.target.value))} className="w-full min-w-0 rounded-md border border-line bg-bg px-2 py-1.5 tabular" />
        <span className="text-muted text-xs">{unit}</span>
      </div>
    </div>
  );
}

function EditedDot() {
  return <span className="ml-1.5 rounded bg-brand-soft px-1 text-[10px] text-ink" title="Changed from the AI's read">edited</span>;
}

function FlagItem({ flag }: { flag: Flag }) {
  const s = FLAG_STYLE[flag.level];
  return (
    <li className={`rounded-lg border px-3 py-2 text-sm ${s.cls}`}>
      <p className="font-medium">
        <span aria-hidden className="mr-1.5">{s.icon}</span>
        <span className="sr-only">{s.label}: </span>
        {flag.title}
      </p>
      <p className="mt-0.5 text-xs text-ink-2">{flag.detail}</p>
    </li>
  );
}

export function JobEstimator() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [options, setOptions] = useState<JobOptions>(DEFAULT_OPTIONS);
  const [notes, setNotes] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "working" | "error" | "done"; message?: string }>({ kind: "idle" });
  const [original, setOriginal] = useState<JobAssessment | null>(null);
  const [job, setJob] = useState<JobAssessment | null>(null);
  const [source, setSource] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedPhotoUrls, setSavedPhotoUrls] = useState<string[]>([]);
  const [save, setSave] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const savedPhotosRef = useRef(savedPhotoUrls);
  savedPhotosRef.current = savedPhotoUrls;

  useEffect(() => {
    const code = loadAccessCode();
    setAccessCode(code);
    // Opened from the estimate history: load that saved estimate for editing.
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) void openSaved(id, code);
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
      savedPhotosRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  async function openSaved(id: string, code: string) {
    setStatus({ kind: "working", message: "Loading saved estimate…" });
    try {
      const { estimate: r } = await gmFetch<{ estimate: EstimateRecord }>(`/api/estimates/${id}`, code);
      setOptions(r.options);
      setCustomer(r.customer);
      setNotes(r.notes);
      setOriginal(r.aiAssessment);
      setJob(structuredClone(r.assessment));
      setSource(`Saved estimate from ${new Date(r.createdAt).toLocaleString()}.`);
      setSavedId(r.id);
      setSave({ kind: "saved", message: "Loaded" });
      setStatus({ kind: "idle" });
      const urls = await Promise.all(r.photos.map((_, i) => gmPhotoUrl(`/api/estimates/${r.id}/photos/${i + 1}`, code)));
      setSavedPhotoUrls(urls.filter((u): u is string => u !== null));
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : "Couldn't load that estimate." });
    }
  }

  async function saveChanges() {
    if (!savedId || !job) return;
    setSave({ kind: "saving" });
    rememberAccessCode(accessCode);
    try {
      await gmFetch(`/api/estimates/${savedId}`, accessCode, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer, notes, options, assessment: job }),
      });
      setSave({ kind: "saved", message: `Saved ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` });
    } catch (e) {
      setSave({ kind: "error", message: e instanceof Error ? e.message : "Save failed." });
    }
  }

  const estimate = useMemo(() => (job && job.trees.length ? estimateJob(job, options) : null), [job, options]);
  const setOpt = <K extends keyof JobOptions>(k: K, v: JobOptions[K]) => setOptions((o) => ({ ...o, [k]: v }));
  const setField = <K extends keyof JobAssessment>(k: K, v: JobAssessment[K]) => setJob((j) => (j ? { ...j, [k]: v } : j));
  const setTree = (i: number, patch: Partial<TreeAssessment>) =>
    setJob((j) => (j ? { ...j, trees: j.trees.map((t, k) => (k === i ? { ...t, ...patch } : t)) } : j));
  const edited = (k: keyof JobAssessment) => original !== null && job !== null && JSON.stringify(original[k]) !== JSON.stringify(job[k]);
  const treeEdited = (i: number, k: keyof TreeAssessment) =>
    original?.trees[i] !== undefined && job?.trees[i] !== undefined && JSON.stringify(original.trees[i][k]) !== JSON.stringify(job.trees[i][k]);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const next = [...files]
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_PHOTOS - photos.length)
      .map((f) => ({ id: `${f.name}-${f.size}-${f.lastModified}`, name: f.name, url: URL.createObjectURL(f), file: f }));
    setPhotos((p) => [...p, ...next]);
  }

  function removePhoto(id: string) {
    setPhotos((p) => {
      const gone = p.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return p.filter((x) => x.id !== id);
    });
  }

  function load(a: JobAssessment, label: string) {
    setOriginal(a);
    setJob(structuredClone(a));
    setSource(label);
    setCopied(false);
  }

  function loadSample(id: string) {
    const s = SAMPLE_JOBS.find((x) => x.id === id)!;
    setOptions({ ...DEFAULT_OPTIONS, ...s.options });
    load(s.assessment, `Sample job: ${s.title}. ${s.photoNote}`);
    setSavedId(null);
    setSave({ kind: "idle" });
    setStatus({ kind: "idle" });
  }

  async function analyze() {
    setStatus({ kind: "working" });
    rememberAccessCode(accessCode);
    try {
      const form = new FormData();
      for (const p of photos) form.append("photos", await shrink(p.file));
      form.append("options", JSON.stringify(options));
      form.append("customer", JSON.stringify(customer));
      form.append("notes", notes);
      const started = Date.now();
      const res = await fetch("/api/assess", { method: "POST", body: form, headers: { "x-gm-access-code": accessCode } });
      const body = await res.json().catch(() => ({ error: `Server error (${res.status}).` }));
      if (!res.ok) {
        setStatus({ kind: "error", message: body.error ?? `Request failed (${res.status}).` });
        return;
      }
      load(body.assessment, `AI read of ${photos.length} photo${photos.length > 1 ? "s" : ""} in ${Math.round((Date.now() - started) / 1000)}s.`);
      setStatus({ kind: "done" });
      if (body.saved?.id) {
        setSavedId(body.saved.id);
        setSave({ kind: "saved", message: "Saved to estimate history" });
      } else {
        setSavedId(null);
        setSave(body.saved?.error ? { kind: "error", message: body.saved.error } : { kind: "idle" });
      }
    } catch {
      setStatus({ kind: "error", message: "Couldn't reach the server. Check the connection and try again." });
    }
  }

  async function copySummary() {
    if (!job || !estimate) return;
    const text = [
      `Estimate: ${usd(estimate.priceLow)}–${usd(estimate.priceHigh)}`,
      "",
      job.summary,
      "",
      `Plan: ${METHOD_LABELS[estimate.method].toLowerCase()}, ${estimate.crew.total}-person crew, about ${estimate.days} day${estimate.days > 1 ? "s" : ""} on-site.`,
      options.haulDebris ? "Includes chipping and hauling all debris." : "Debris left on-site.",
      options.grindStumps && options.service === "removal" ? "Includes stump grinding." : "",
      "",
      "Final price is confirmed in writing before work starts. Fully insured.",
    ]
      .filter((l, i, a) => l !== "" || a[i - 1] !== "")
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const groups = estimate ? (["Labor", "Equipment", "Disposal", "Other"] as const).map((g) => ({ g, lines: estimate.lines.filter((l) => l.group === g) })).filter((x) => x.lines.length) : [];
  const stopped = estimate?.flags.some((f) => f.level === "stop");

  return (
    <div className="space-y-6">
      {/* ---------------- Inputs ---------------- */}
      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-4">
            <div>
              <h2 className="font-semibold">1. Photos from the customer</h2>
              <p className="text-xs text-muted mt-0.5">Best results: one wide shot showing the whole tree with the house or a person for scale, one of what&apos;s under it, one from where a truck would park.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {savedPhotoUrls.map((u, i) => (
                <div key={u} className="size-24 overflow-hidden rounded-lg border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private photo loaded as an object URL */}
                  <img src={u} alt={`Saved photo ${i + 1}`} className="size-full object-cover" />
                </div>
              ))}
              {photos.map((p) => (
                <div key={p.id} className="relative size-24 overflow-hidden rounded-lg border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img src={p.url} alt={p.name} className="size-full object-cover" />
                  <button type="button" onClick={() => removePhoto(p.id)} aria-label={`Remove ${p.name}`} className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">✕</button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className="flex size-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-bg text-xs text-muted hover:bg-surface-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand">
                  <span className="text-xl leading-none">+</span>
                  Add photos
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-medium">Customer</legend>
              {(
                [
                  ["name", "Name", "name"],
                  ["phone", "Phone", "tel"],
                  ["email", "Email", "email"],
                  ["address", "Job address", "street-address"],
                ] as const
              ).map(([k, label, auto]) => (
                <label key={k} className="block text-sm">
                  <span className="text-ink-2">{label}</span>
                  <input
                    value={customer[k]}
                    onChange={(e) => setCustomer((c) => ({ ...c, [k]: e.target.value }))}
                    autoComplete={auto}
                    className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-1.5"
                  />
                </label>
              ))}
            </fieldset>
            <label className="block text-sm">
              <span className="text-ink-2">Notes for the estimator (optional)</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. Customer says the gate is 4 ft wide; wants the wood left for firewood" className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2" />
            </label>
          </div>
          <div className="space-y-3">
            <Select<Service> label="Work requested" value={options.service} onChange={(v) => setOpt("service", v)} options={[["removal", "Removal"], ["trim", "Trimming / pruning"], ["stump", "Stump grinding only"]]} />
            <Select<Locality> label="Locality" value={options.locality} onChange={(v) => setOpt("locality", v)} options={[["Richmond", "City of Richmond"], ["Henrico", "Henrico County"], ["Chesterfield", "Chesterfield County"]]} />
            <div className="space-y-1.5 text-sm">
              {options.service === "removal" && (
                <label className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--brand)]" checked={options.grindStumps} onChange={(e) => setOpt("grindStumps", e.target.checked)} /> Grind stumps</label>
              )}
              {options.service !== "stump" && (
                <label className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--brand)]" checked={options.haulDebris} onChange={(e) => setOpt("haulDebris", e.target.checked)} /> Chip and haul debris</label>
              )}
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--brand)]" checked={options.historicDistrict} onChange={(e) => setOpt("historicDistrict", e.target.checked)} /> In a historic district</label>
            </div>
            <label className="block text-sm">
              <span className="text-ink-2">GM access code</span>
              <input type="password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-1.5" />
            </label>
            <button
              type="button"
              onClick={analyze}
              disabled={photos.length === 0 || status.kind === "working"}
              className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-on-brand hover:bg-brand-strong disabled:opacity-50"
            >
              {status.kind === "working" ? status.message ?? "Analyzing photos… (up to a minute)" : "Analyze photos"}
            </button>
          </div>
        </div>
        {status.kind === "error" && (
          <p role="alert" className="mt-4 rounded-md border border-warn/40 bg-warn-soft px-3 py-2 text-sm">{status.message}</p>
        )}
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-xs text-muted">No photos handy? Load a sample job (saved AI reads of real-world-style photos):</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SAMPLE_JOBS.map((s) => (
              <button key={s.id} type="button" onClick={() => loadSample(s.id)} className="rounded-full border border-line bg-bg px-3 py-1 text-sm hover:bg-surface-2">
                {s.title}
              </button>
            ))}
          </div>
        </div>
      </section>

      {job && (
        <div className="grid gap-6 lg:grid-cols-[1fr_400px] items-start">
          {/* ---------------- Assessment ---------------- */}
          <section className="min-w-0 rounded-xl border border-line bg-surface p-5 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">2. What the photos show</h2>
                <p className="text-xs text-muted mt-0.5">{source}</p>
                <p className="text-xs text-muted">Correct anything that&apos;s wrong; the quote updates as you edit.</p>
              </div>
              {original && (
                <button type="button" onClick={() => setJob(structuredClone(original))} className="text-xs text-muted underline">Reset to AI read</button>
              )}
            </div>
            <p className="text-sm text-ink-2">{job.summary}</p>

            {job.trees.map((t, i) => (
              <div key={i} className="rounded-lg border border-line p-4 space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium">{t.label}</h3>
                  <span className="text-xs text-muted">{t.species} · height confidence {t.heightConfidence}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <RangeInput label="Height" unit="ft" low={t.heightFtLow} high={t.heightFtHigh} edited={treeEdited(i, "heightFtLow") || treeEdited(i, "heightFtHigh")} onChange={(lo, hi) => setTree(i, { heightFtLow: lo, heightFtHigh: hi })} />
                  <RangeInput label="Trunk diameter" unit="in" low={t.trunkDiameterInLow} high={t.trunkDiameterInHigh} edited={treeEdited(i, "trunkDiameterInLow") || treeEdited(i, "trunkDiameterInHigh")} onChange={(lo, hi) => setTree(i, { trunkDiameterInLow: lo, trunkDiameterInHigh: hi })} />
                  <Select label="Condition" value={t.condition} edited={treeEdited(i, "condition")} onChange={(v) => setTree(i, { condition: v })} options={[["healthy", "Healthy"], ["declining", "Declining"], ["dead", "Dead"], ["storm_damaged", "Storm damaged"]]} />
                  <Select label="Lean" value={t.lean} edited={treeEdited(i, "lean")} onChange={(v) => setTree(i, { lean: v })} options={[["none", "None"], ["slight", "Slight"], ["severe", "Severe"]]} />
                </div>
                {t.defects.length > 0 && <p className="text-xs text-ink-2">Defects: {t.defects.join(" · ")}</p>}
              </div>
            ))}

            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Power lines" value={job.powerLines} edited={edited("powerLines")} onChange={(v) => setField("powerLines", v)} options={[["none_visible", "None visible"], ["service_drop_nearby", "House service line nearby"], ["primary_lines_nearby", "Primary lines within ~15 ft"], ["lines_in_canopy", "Lines in the canopy"]]} />
              <Select label="Truck access" value={job.truckAccess} edited={edited("truckAccess")} onChange={(v) => setField("truckAccess", v)} options={[["driveway_adjacent", "Can park beside it"], ["through_gate", "Through a gate / across yard"], ["no_vehicle_access", "No vehicle access"]]} />
              <Select label="Drop zone" value={job.dropZone} edited={edited("dropZone")} onChange={(v) => setField("dropZone", v)} options={[["open_fell_possible", "Open: can fell whole"], ["limited_sectional", "Limited: drop in sections"], ["no_drop_zone", "None: lower or lift everything"]]} />
              <Select label="Terrain" value={job.terrain} edited={edited("terrain")} onChange={(v) => setField("terrain", v)} options={[["flat", "Flat"], ["moderate_slope", "Moderate slope"], ["steep", "Steep"]]} />
              <Select label="Overall confidence" value={job.overallConfidence} edited={edited("overallConfidence")} onChange={(v) => setField("overallConfidence", v)} options={[["high", "High"], ["medium", "Medium"], ["low", "Low"]]} />
            </div>

            <fieldset>
              <legend className="text-sm text-ink-2">Could be hit{edited("targets") && <EditedDot />}</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {TARGETS.map((t) => {
                  const on = job.targets.includes(t.value);
                  return (
                    <label key={t.value} className={`cursor-pointer rounded-full border px-3 py-1 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${on ? "border-brand bg-brand-soft" : "border-line"}`}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => setField("targets", on ? job.targets.filter((x) => x !== t.value) : [...job.targets, t.value])} />
                      {t.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--brand)]" checked={job.nearRoadway} onChange={(e) => setField("nearRoadway", e.target.checked)} /> At a public street or sidewalk{edited("nearRoadway") && <EditedDot />}</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--brand)]" checked={job.nearWater} onChange={(e) => setField("nearWater", e.target.checked)} /> Water within ~100 ft{edited("nearWater") && <EditedDot />}</label>
            </div>
            {job.scaleReference && <p className="text-xs text-muted">Scale judged from: {job.scaleReference} · photo quality {job.photoQuality}</p>}
            {job.missingInfo.length > 0 && (
              <div>
                <h3 className="text-sm font-medium">Ask the customer</h3>
                <ul className="mt-1 list-disc pl-5 text-sm text-ink-2 space-y-0.5">
                  {job.missingInfo.map((q) => <li key={q}>{q}</li>)}
                </ul>
              </div>
            )}
          </section>

          {/* ---------------- Quote ---------------- */}
          {estimate && (
            <section className="lg:sticky lg:top-6 min-w-0 rounded-xl border border-line bg-surface p-5 space-y-4">
              <div>
                <h2 className="font-semibold">3. Draft quote</h2>
                <p className={`mt-2 text-3xl font-semibold tabular ${stopped ? "text-muted line-through" : ""}`}>
                  {usd(estimate.priceLow)} – {usd(estimate.priceHigh)}
                </p>
                <p className="text-xs text-muted tabular">
                  Cost {usd(estimate.costLow)}–{usd(estimate.costHigh)} · includes overhead and target margin
                </p>
              </div>

              {estimate.flags.length > 0 && (
                <ul className="space-y-2">
                  {estimate.flags.map((f) => <FlagItem key={f.title} flag={f} />)}
                </ul>
              )}

              <div className="text-sm space-y-1">
                <p><span className="text-muted">Method:</span> {METHOD_LABELS[estimate.method]}</p>
                <p className="tabular">
                  <span className="text-muted">Crew:</span> {estimate.crew.total} ({estimate.crew.climbers ? `${estimate.crew.climbers} lead + ` : ""}{estimate.crew.ground} ground) ·{" "}
                  {estimate.onSiteHoursLow.toFixed(1)}–{estimate.onSiteHoursHigh.toFixed(1)} hrs on-site · {estimate.days} day{estimate.days > 1 ? "s" : ""}
                </p>
                {estimate.trees.filter((t) => t.reasons.length).map((t) => (
                  <p key={t.label} className="text-xs text-ink-2">
                    {estimate.trees.length > 1 && <strong>{t.label}: </strong>}
                    {t.reasons.join("; ")}.
                  </p>
                ))}
              </div>

              <table className="w-full text-sm tabular">
                <tbody>
                  {groups.map(({ g, lines }) => (
                    <FragmentRows key={g} title={g} lines={lines} />
                  ))}
                </tbody>
              </table>

              <div className="rounded-lg border border-line p-3 text-sm space-y-2">
                {savedId ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className={save.kind === "error" ? "text-bad" : "text-ink-2"} role="status">
                        {save.kind === "saving" ? "Saving…" : save.message ?? "Saved"}
                      </span>
                      <a href={`/estimates/${savedId}`} className="text-xs underline text-muted">Open in history</a>
                    </div>
                    <button type="button" onClick={saveChanges} disabled={save.kind === "saving"} className="w-full rounded-lg bg-brand px-4 py-2 font-medium text-on-brand hover:bg-brand-strong disabled:opacity-50">
                      Save changes
                    </button>
                  </>
                ) : save.kind === "error" ? (
                  <p className="text-bad" role="status">{save.message}</p>
                ) : (
                  <p className="text-muted">{source.startsWith("Sample") ? "Sample jobs aren't saved." : "Not saved: estimate history isn't set up on this deployment."}</p>
                )}
              </div>

              <button
                type="button"
                onClick={copySummary}
                disabled={stopped}
                className="w-full rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface-2 disabled:opacity-50"
              >
                {copied ? "Copied" : "Copy customer summary"}
              </button>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function FragmentRows({ title, lines }: { title: string; lines: { label: string; low: number; high: number }[] }) {
  return (
    <>
      <tr>
        <th colSpan={2} className="pt-3 pb-1 text-left text-xs font-normal text-muted">{title}</th>
      </tr>
      {lines.map((l) => (
        <tr key={l.label} className="border-t border-line">
          <td className="py-1.5 pr-3 text-ink-2">{l.label}</td>
          <td className="py-1.5 text-right whitespace-nowrap">{l.low === l.high ? usd(l.low) : `${usd(l.low)}–${usd(l.high)}`}</td>
        </tr>
      ))}
    </>
  );
}
