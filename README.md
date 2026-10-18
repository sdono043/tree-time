# tree-time

Demos for **Richmond Tree Care Co.**, a manager-run tree care business planned for the Richmond, VA metro.
The demos show what sets it apart from a typical local tree service, using seeded sample data, so they can be shown without real customers.

## What's here

| Route | What it shows |
|---|---|
| `/` | Short landing page for the business |
| `/quote` | **Instant quote estimator.** Services (any mix of trim, removal, stump grinding), tree size, access, what it could hit, distance to the street, cleanup and storm flag produce a live, itemized price range (bucket truck, crane allowance, loader and traffic control as their own lines) and a request for a firm written quote |
| `/estimator` | **Photo job estimator (GM tool).** Upload customer photos; Claude reads the job (trees, size ranges, condition, hazards, power lines, access, drop zone) and the rate card prices it: method, crew, hours, equipment, disposal, permit and licensing flags. Every field the AI reads can be corrected and the quote recalculates |
| `/estimates` | **Saved estimates (GM tool).** Every photo analysis is saved automatically with its photos, customer, the AI's read, the GM's corrections and the quote. Track status (draft, sent, won, lost) and the final price; the detail page compares the AI-only quote, the corrected quote and what was actually charged |
| `/dashboard` | **Owner dashboard.** Jobs/week, close rate, average ticket, crew utilization, plan cash, Year 1 revenue vs. cost, projected cash balance, an equipment rent-vs-buy table, a monthly cash-flow table, lead sources, recent quote requests and capital uses. A toggle switches the plan between renting all equipment and financing the core fleet used |

Quote requests submitted on `/quote` go to `POST /api/leads` and are saved in the private Blob store as `quote-requests/<ref>.json` (the price is recomputed on the server). The dashboard lists them under "Recent quote requests" after the GM enters the access code, on any device. Without a Blob store, the page falls back to saving the request in that browser only.

## Where the numbers come from

- `src/data/financial-model.json` is the **source of truth** for the plan: capital raise and uses, capacity, monthly job and ticket ramp, fixed and per-job costs, and an equipment schedule (chip trucks, chippers, bucket truck, stump grinder, loader) with retail rental rates, used and new purchase prices, maintenance and loan terms. Two strategies are modeled: rent everything, or finance the core fleet used. `src/lib/model.ts` projects the monthly P&L and cash from it. Tests check that the financed scenario stays close to the deck's Year 1 P&L (~$430K revenue, ~$502K cost, break-even in Month 8–9) and that renting everything doesn't break even in Year 1.
- `src/lib/pricing.ts` holds the quote estimator's price bands and multipliers, plus a helper that maps contract value to the Virginia DPOR contractor class (shown internally on the dashboard).
- `src/lib/sample-data.ts` generates a deterministic lead/job history through Month 7 for the operational KPIs.

All costs and prices are industry benchmarks, **not Richmond quotes**. GL and workers' comp premiums and equipment rental rates move the model most; replace them with real quotes before relying on the numbers.

## Photo estimator

- `src/lib/assessment.ts`: the schema Claude fills in from photos (structured output). It describes the job only; it never prices it.
- `src/lib/job-estimator.ts`: deterministic cost-plus pricing from `src/data/rate-card.json` (loaded labor rates, equipment day rates, crane, grinder, dump fees, overhead, target margin). It picks a method per tree (fell, bucket truck, climb and rig, crane) and raises flags: power lines in the canopy stop the quote, and crane jobs, very tall or compromised trees and low-confidence reads need a site visit. It also flags right-of-way, Chesapeake Bay RPA and historic-district checks, the DPOR class and the BPOL license.
- `src/app/api/assess/route.ts`: sends up to 6 photos to Claude (`claude-opus-5-5`, server-side refusal fallback on) and returns the assessment.

Photo analysis needs two environment variables, set in Vercel under Project → Settings → Environment Variables:

| Variable | What it is |
|---|---|
| `ANTHROPIC_API_KEY` | API key from console.anthropic.com. Each analysis costs a few cents. |
| `GM_ACCESS_CODE` | Any passphrase. The GM enters it on the estimator page, so visitors to the public site can't spend API credit. |

Without both, the page runs in demo mode with four saved sample jobs.

Saved estimates live in a **private Vercel Blob store** connected to the project (Storage tab), which adds `BLOB_READ_WRITE_TOKEN` (or `BLOB_STORE_ID` for OIDC). Layout: `estimates/<id>/record.json` plus `estimates/<id>/photo-<n>.jpg`. Photos are served only through `/api/estimates/<id>/photos/<n>` with the GM access code. Without a store, analyses still work but aren't saved. The permit and licensing flags are prompts to check, not legal advice.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # pricing + financial model tests
npm run lint
npm run build
```

Stack: Next.js (App Router) + TypeScript + Tailwind. Charts are dependency-free SVG. Supabase and Vercel deployment are planned next steps; the first version runs entirely on mock data.
