"use client";

import { useEffect, useRef, useState } from "react";

const ARCGIS_URL =
  "https://services1.arcgis.com/k3vhq11XkBNeeOfM/arcgis/rest/services/Parcels/FeatureServer/0/query";

// Approximate feet-per-degree at Windsor Farms latitude
const LAT_FT = 364320;
const LNG_FT = 364320 * Math.cos((37.555 * Math.PI) / 180);

interface ArcFeature {
  attributes: { MailAddress: string };
  geometry?: { rings: number[][][] };
}

function geomAreaSqFt(geom: { rings: number[][][] } | undefined): number {
  if (!geom?.rings) return 0;
  let total = 0;
  for (const ring of geom.rings) {
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
    }
    total += a / 2;
  }
  return Math.abs(total) * LNG_FT * LAT_FT;
}

const SUFFIX_RE =
  /\s+(road|rd|street|st|avenue|ave|drive|dr|lane|ln|court|ct|place|pl|way|circle|cir|boulevard|blvd|trail|trl|terrace|ter|run)\.?$/i;

function addrSearchKey(raw: string): string {
  return raw.replace(SUFFIX_RE, "").toUpperCase().trim();
}

function buildAddrUrl(searchKey: string, count: number): string {
  const params = new URLSearchParams({
    where: `MailAddress LIKE '%${searchKey}%'`,
    outFields: "MailAddress",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: String(count),
    f: "json",
  });
  return `${ARCGIS_URL}?${params}`;
}

function calcCost(acres: number): number {
  if (acres <= 0) return 25;
  return Math.max(25, Math.round(acres * 40));
}

// Oct–Jan date range helpers
function leafSeasonMin(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  // If before October, use Oct 1 of this year; if Feb+, use Oct 1 of this year
  if (m < 10) return `${y}-10-01`;
  return `${y}-10-01`;
}

function leafSeasonMax(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (m >= 10) return `${y + 1}-01-31`;
  return `${y}-01-31`;
}

function buildSlots(dateStr: string): string[] {
  if (!dateStr) return [];
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay(); // 0=Sun, 6=Sat
  const weekend = dow === 0 || dow === 6;
  const slots: string[] = [];
  const fmt = (h: number, m: number) => {
    const period = h < 12 ? "AM" : "PM";
    const hd = h % 12 === 0 ? 12 : h % 12;
    return `${hd}:${String(m).padStart(2, "0")} ${period}`;
  };
  if (weekend) {
    for (let h = 9; h <= 15; h++) {
      for (let m = 0; m < 60; m += 15) {
        if (h === 15 && m > 45) break;
        slots.push(fmt(h, m));
      }
    }
  } else {
    for (let h = 15; h <= 16; h++) {
      for (let m = 0; m < 60; m += 15) {
        if (h === 16 && m > 45) break;
        slots.push(fmt(h, m));
      }
    }
  }
  return slots;
}

type Status = "idle" | "submitting" | "success" | "error";

export function LeafPickup() {
  const [addrInput, setAddrInput] = useState("");
  const [suggestions, setSuggestions] = useState<ArcFeature[]>([]);
  const [acres, setAcres] = useState(0);
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [bookingId, setBookingId] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cost = calcCost(acres);
  const slots = buildSlots(date);

  // Fetch address suggestions (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const key = addrSearchKey(addrInput);
    if (key.length < 4) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(buildAddrUrl(key, 8));
        const json = await res.json();
        const features: ArcFeature[] = json.features ?? [];
        setSuggestions(features);
        // Auto-apply first result's area
        if (features.length > 0 && features[0].geometry) {
          const sqft = geomAreaSqFt(features[0].geometry);
          setAcres(sqft / 43560);
        }
      } catch {
        setSuggestions([]);
      }
    }, 400);
  }, [addrInput]);

  // Fetch booked slots when date changes
  useEffect(() => {
    if (!date) {
      setBookedSlots([]);
      return;
    }
    fetch(`/api/leaf-booking?date=${date}`)
      .then((r) => r.json())
      .then((j) => setBookedSlots(j.slots ?? []))
      .catch(() => setBookedSlots([]));
    setTimeSlot("");
  }, [date]);

  function onAddrSelect(feature: ArcFeature) {
    setAddrInput(feature.attributes.MailAddress);
    setSuggestions([]);
    if (feature.geometry) {
      const sqft = geomAreaSqFt(feature.geometry);
      setAcres(sqft / 43560);
    }
  }

  async function handleSubmit() {
    if (!addrInput || !date || !timeSlot || !name || !email || !phone) {
      setErrorMsg("Please fill in all fields.");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/leaf-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          address: addrInput,
          date,
          timeSlot,
          lotSizeAcres: acres,
          estimatedCost: cost,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? "Something went wrong.");
        setStatus("error");
        // Refresh slots in case of conflict
        if (res.status === 409) {
          const r2 = await fetch(`/api/leaf-booking?date=${date}`);
          const j2 = await r2.json();
          setBookedSlots(j2.slots ?? []);
          setTimeSlot("");
        }
        return;
      }
      setBookingId(json.id);
      setStatus("success");
    } catch {
      setErrorMsg("Network error — please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-3xl">🍂</div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">You&rsquo;re scheduled!</h1>
        <p className="mt-2 text-ink-2">
          We&rsquo;ll vacuum your curb on <strong>{date}</strong> at <strong>{timeSlot}</strong>.
        </p>
        <p className="mt-1 text-ink-2">
          Estimated cost: <strong>${cost}</strong>. Rake your leaves to the curb before we arrive.
        </p>
        <p className="mt-4 text-sm text-muted">Confirmation #{bookingId.slice(0, 8).toUpperCase()}</p>
        <p className="mt-6 text-sm text-ink-2">
          Questions?{" "}
          <a href="tel:+18045550100" className="text-brand underline">
            (804) 555-0100
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Leaf pickup scheduling</h1>
        <p className="mt-1 text-ink-2">
          Curb-side leaf vacuum service — rake to the curb, we do the rest.
          Season runs October&ndash;January.
        </p>
      </div>

      {/* Address & Estimate */}
      <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Your address</h2>
        <label className="mb-1 block text-sm font-medium text-ink-2" htmlFor="addr">
          Street address
        </label>
        <input
          id="addr"
          type="text"
          list="addr-list"
          value={addrInput}
          onChange={(e) => {
            setAddrInput(e.target.value);
            const match = suggestions.find(
              (f) => f.attributes.MailAddress === e.target.value,
            );
            if (match) onAddrSelect(match);
          }}
          placeholder="3803 Exeter Road"
          autoComplete="off"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <datalist id="addr-list">
          {suggestions.map((f) => (
            <option key={f.attributes.MailAddress} value={f.attributes.MailAddress} />
          ))}
        </datalist>

        {acres > 0 && (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-brand-soft px-4 py-3">
            <span className="text-2xl">🍃</span>
            <div>
              <p className="text-sm text-ink-2">
                Lot size: <strong>{(acres * 43560).toLocaleString()} sq ft</strong> ({acres.toFixed(3)} acres)
              </p>
              <p className="text-lg font-semibold text-brand-strong">
                Estimated cost: ${cost}
              </p>
              <p className="text-xs text-muted">$40/acre · $25 minimum · paid at service</p>
            </div>
          </div>
        )}
      </section>

      {/* Date & Time */}
      <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Pick a date &amp; time</h2>
        <label className="mb-1 block text-sm font-medium text-ink-2" htmlFor="datepick">
          Date (Oct&ndash;Jan · weekends 9 am&ndash;4 pm · weekdays 3&ndash;5 pm)
        </label>
        <input
          id="datepick"
          type="date"
          value={date}
          min={leafSeasonMin()}
          max={leafSeasonMax()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />

        {date && slots.length === 0 && (
          <p className="mt-3 text-sm text-warn">No slots available on this day.</p>
        )}

        {date && slots.length > 0 && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {slots.map((s) => {
              const booked = bookedSlots.includes(s);
              const active = timeSlot === s;
              return (
                <button
                  key={s}
                  disabled={booked}
                  onClick={() => setTimeSlot(s)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors
                    ${booked ? "cursor-not-allowed border-line bg-surface-2 text-muted line-through" : ""}
                    ${!booked && active ? "border-brand bg-brand text-on-brand" : ""}
                    ${!booked && !active ? "border-line hover:border-brand hover:text-brand" : ""}
                  `}
                >
                  {s}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Contact info */}
      <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Your contact info</h2>
        <div className="space-y-3">
          {[
            { id: "cname", label: "Name", value: name, onChange: setName, placeholder: "Sam Donovan", type: "text" },
            { id: "cemail", label: "Email", value: email, onChange: setEmail, placeholder: "sam@example.com", type: "email" },
            { id: "cphone", label: "Phone", value: phone, onChange: setPhone, placeholder: "(804) 555-0100", type: "tel" },
          ].map(({ id, label, value, onChange, placeholder, type }) => (
            <div key={id}>
              <label className="mb-1 block text-sm font-medium text-ink-2" htmlFor={id}>
                {label}
              </label>
              <input
                id={id}
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Payment note */}
      <p className="text-sm text-muted">
        Payment collected at service via{" "}
        <a
          href="https://venmo.com/RichmondTreeCare"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline"
        >
          Venmo
        </a>{" "}
        or cash.
      </p>

      {/* Error */}
      {status === "error" && (
        <p className="rounded-lg border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">{errorMsg}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={status === "submitting" || !addrInput || !date || !timeSlot || !name || !email || !phone}
        className="w-full rounded-xl bg-brand px-6 py-3 font-medium text-on-brand transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "submitting" ? "Scheduling…" : `Schedule pickup — $${cost}`}
      </button>
    </div>
  );
}
