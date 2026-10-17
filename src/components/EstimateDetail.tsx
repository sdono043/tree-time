"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessGate } from "./AccessGate";
import { StatusPill } from "./EstimatesList";
import type { JobAssessment } from "@/lib/assessment";
import { STATUS_LABELS, type EstimateRecord, type EstimateStatus } from "@/lib/estimate-record";
import { estimateJob, METHOD_LABELS } from "@/lib/job-estimator";
import { gmFetch, gmPhotoUrl, loadAccessCode, rememberAccessCode } from "@/lib/gm-client";
import { usd } from "@/lib/format";

const VALUE_LABELS: Record<string, string> = {
  none_visible: "None visible",
  service_drop_nearby: "House service line nearby",
  primary_lines_nearby: "Primary lines nearby",
  lines_in_canopy: "Lines in the canopy",
  driveway_adjacent: "Can park beside it",
  through_gate: "Through a gate",
  no_vehicle_access: "No vehicle access",
  open_fell_possible: "Open: can fell whole",
  limited_sectional: "Limited: sections",
  no_drop_zone: "None",
  moderate_slope: "Moderate slope",
  storm_damaged: "Storm damaged",
  road_or_sidewalk: "road / sidewalk",
  neighbor_property: "neighbor's property",
  true: "Yes",
  false: "No",
};
const label = (v: string) => VALUE_LABELS[v] ?? v.charAt(0).toUpperCase() + v.slice(1);

/** Fields worth comparing between the AI's read and the GM's corrected version. */
function differences(ai: JobAssessment, gm: JobAssessment): { field: string; ai: string; gm: string }[] {
  const rows: { field: string; ai: string; gm: string }[] = [];
  const add = (field: string, a: unknown, b: unknown) => {
    const show = (v: unknown) => (Array.isArray(v) ? v.map((x) => VALUE_LABELS[x] ?? x).join(", ") || "Nothing" : label(String(v)));
    const fa = show(a);
    const fb = show(b);
    if (fa !== fb) rows.push({ field, ai: fa, gm: fb });
  };
  gm.trees.forEach((t, i) => {
    const a = ai.trees[i];
    if (!a) return;
    const prefix = gm.trees.length > 1 ? `${t.label}: ` : "";
    add(`${prefix}Height (ft)`, `${a.heightFtLow}–${a.heightFtHigh}`, `${t.heightFtLow}–${t.heightFtHigh}`);
    add(`${prefix}Trunk (in)`, `${a.trunkDiameterInLow}–${a.trunkDiameterInHigh}`, `${t.trunkDiameterInLow}–${t.trunkDiameterInHigh}`);
    add(`${prefix}Condition`, a.condition, t.condition);
    add(`${prefix}Lean`, a.lean, t.lean);
  });
  add("Power lines", ai.powerLines, gm.powerLines);
  add("Truck access", ai.truckAccess, gm.truckAccess);
  add("Drop zone", ai.dropZone, gm.dropZone);
  add("Terrain", ai.terrain, gm.terrain);
  add("Could be hit", ai.targets, gm.targets);
  add("At street", ai.nearRoadway, gm.nearRoadway);
  add("Water nearby", ai.nearWater, gm.nearWater);
  add("Confidence", ai.overallConfidence, gm.overallConfidence);
  return rows;
}

export function EstimateDetail({ id }: { id: string }) {
  const [code, setCode] = useState("");
  const [state, setState] = useState<{ kind: "loading" | "ready" | "locked" | "error"; message?: string }>({ kind: "loading" });
  const [record, setRecord] = useState<EstimateRecord | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [status, setStatus] = useState<EstimateStatus>("draft");
  const [finalPrice, setFinalPrice] = useState("");
  const [save, setSave] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const urlsRef = useRef<string[]>([]);

  async function load(c: string) {
    setState({ kind: "loading" });
    try {
      const { estimate } = await gmFetch<{ estimate: EstimateRecord }>(`/api/estimates/${id}`, c);
      rememberAccessCode(c);
      setCode(c);
      setRecord(estimate);
      setStatus(estimate.status);
      setFinalPrice(estimate.finalPrice === null ? "" : String(estimate.finalPrice));
      setState({ kind: "ready" });
      const urls = await Promise.all(estimate.photos.map((_, i) => gmPhotoUrl(`/api/estimates/${id}/photos/${i + 1}`, c)));
      urlsRef.current = urls.filter((u): u is string => u !== null);
      setPhotoUrls(urlsRef.current);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't load this estimate.";
      setState(/access code/i.test(message) ? { kind: "locked", message } : { kind: "error", message });
    }
  }

  useEffect(() => {
    const c = loadAccessCode();
    if (c) void load(c);
    else setState({ kind: "locked" });
    return () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per id
  }, [id]);

  const current = useMemo(() => (record ? estimateJob(record.assessment, record.options) : null), [record]);
  const aiOnly = useMemo(() => (record ? estimateJob(record.aiAssessment, record.options) : null), [record]);
  const diffs = useMemo(() => (record ? differences(record.aiAssessment, record.assessment) : []), [record]);

  async function saveOutcome() {
    const price = finalPrice.trim() === "" ? null : Number(finalPrice.replace(/[$,]/g, ""));
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      setSave({ kind: "error", message: "Final price must be a number." });
      return;
    }
    setSave({ kind: "saving" });
    try {
      const { estimate } = await gmFetch<{ estimate: EstimateRecord }>(`/api/estimates/${id}`, code, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, finalPrice: price }),
      });
      setRecord(estimate);
      setSave({ kind: "saved", message: "Saved" });
    } catch (e) {
      setSave({ kind: "error", message: e instanceof Error ? e.message : "Save failed." });
    }
  }

  if (state.kind === "locked") return <AccessGate message={state.message} onSubmit={(c) => void load(c)} />;
  if (state.kind === "loading") return <p className="text-ink-2">Loading estimate…</p>;
  if (state.kind === "error" || !record || !current || !aiOnly) {
    return <p role="alert" className="rounded-md border border-warn/40 bg-warn-soft px-3 py-2 text-sm">{state.message ?? "Couldn't load this estimate."}</p>;
  }

  const c = record.customer;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{c.name || "Unnamed customer"}</h1>
          <p className="mt-1 text-ink-2">
            {c.address || "No address"} · {new Date(record.createdAt).toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-ink-2">
            {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact details"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={record.status} />
          <Link href={`/estimator?id=${record.id}`} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-surface-2">Edit in estimator</Link>
        </div>
      </div>

      {photoUrls.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {photoUrls.map((u, i) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- private photo loaded as an object URL */}
              <img src={u} alt={`Job photo ${i + 1}`} className="h-40 w-auto rounded-lg border border-line object-cover" />
            </a>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="min-w-0 rounded-xl border border-line bg-surface p-5 space-y-3">
          <h2 className="font-semibold">Outcome</h2>
          <label className="block text-sm">
            <span className="text-ink-2">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as EstimateStatus)} className="mt-1 w-full rounded-md border border-line bg-bg px-2 py-1.5">
              {(Object.keys(STATUS_LABELS) as EstimateStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-ink-2">Final price charged</span>
            <input inputMode="decimal" value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} placeholder="e.g. 2400" className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-1.5 tabular" />
          </label>
          <button type="button" onClick={saveOutcome} disabled={save.kind === "saving"} className="w-full rounded-lg bg-brand px-4 py-2 font-medium text-on-brand hover:bg-brand-strong disabled:opacity-50">
            {save.kind === "saving" ? "Saving…" : "Save outcome"}
          </button>
          {save.message && <p role="status" className={`text-sm ${save.kind === "error" ? "text-bad" : "text-ink-2"}`}>{save.message}</p>}
        </section>

        <section className="min-w-0 rounded-xl border border-line bg-surface p-5 space-y-3 lg:col-span-2">
          <h2 className="font-semibold">Price check</h2>
          <dl className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <dt className="text-muted">From the AI&apos;s read alone</dt>
              <dd className="text-xl font-semibold tabular">{usd(aiOnly.priceLow)}–{usd(aiOnly.priceHigh)}</dd>
            </div>
            <div>
              <dt className="text-muted">Quote after your edits</dt>
              <dd className="text-xl font-semibold tabular">{usd(current.priceLow)}–{usd(current.priceHigh)}</dd>
            </div>
            <div>
              <dt className="text-muted">Final price charged</dt>
              <dd className="text-xl font-semibold tabular">{record.finalPrice === null ? "–" : usd(record.finalPrice)}</dd>
            </div>
          </dl>
          <p className="text-xs text-ink-2">
            {METHOD_LABELS[current.method]} · {current.crew.total}-person crew · {current.onSiteHoursLow.toFixed(1)}–{current.onSiteHoursHigh.toFixed(1)} hrs · cost {usd(current.costLow)}–{usd(current.costHigh)}
          </p>
          {current.flags.filter((f) => f.level !== "info").length > 0 && (
            <p className="text-xs text-ink-2">Flags: {current.flags.filter((f) => f.level !== "info").map((f) => f.title).join(" · ")}</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-semibold">AI read vs. your corrections</h2>
        <p className="mt-1 text-sm text-ink-2">{record.assessment.summary}</p>
        {diffs.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No corrections: the quote uses the AI&apos;s read as-is.</p>
        ) : (
          <table className="mt-3 w-full text-sm tabular">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 font-normal">Field</th>
                <th className="pb-2 font-normal">AI read</th>
                <th className="pb-2 font-normal">Your version</th>
              </tr>
            </thead>
            <tbody>
              {diffs.map((d) => (
                <tr key={d.field} className="border-t border-line">
                  <td className="py-1.5 pr-3 text-ink-2">{d.field}</td>
                  <td className="py-1.5 pr-3 text-muted line-through">{d.ai}</td>
                  <td className="py-1.5">{d.gm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {record.notes && <p className="mt-3 text-sm"><span className="text-muted">Notes:</span> {record.notes}</p>}
        {record.model && <p className="mt-2 text-xs text-muted">Read by {record.model}.</p>}
      </section>
    </div>
  );
}
