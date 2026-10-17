# tree-time

Demos for **Richmond Tree Care Co.**, a manager-run tree care business planned for the Richmond, VA metro.
The demos show what sets it apart from a typical local tree service, using seeded sample data, so they can be shown without real customers.

## What's here

| Route | What it shows |
|---|---|
| `/` | Short landing page for the business |
| `/quote` | **Instant quote estimator.** Service, tree size, access, hazards, stumps, cleanup, storm flag and photo upload produce a live price range and a booking request |
| `/dashboard` | **Owner dashboard.** Jobs/week, close rate, average ticket, crew utilization, plan cash, Year 1 revenue vs. cost, projected cash balance, lead sources, recent quote requests and capital uses |

Quote requests submitted on `/quote` are saved in the browser (localStorage) and appear first under "Recent quote requests" on the dashboard. Nothing is sent anywhere.

## Where the numbers come from

- `src/data/financial-model.json` is the **source of truth** for the plan: capital raise and uses, capacity, monthly job and ticket ramp, fixed and per-job costs. `src/lib/model.ts` projects the monthly P&L and cash from it. A test checks that the projection stays within tolerance of the deck's Year 1 targets (~$430K revenue, ~$502K cost, ~−$72K net, break-even in Month 8–9).
- `src/lib/pricing.ts` holds the quote estimator's price bands and multipliers, plus a helper that maps contract value to the Virginia DPOR contractor class (shown internally on the dashboard).
- `src/lib/sample-data.ts` generates a deterministic lead/job history through Month 7 for the operational KPIs.

All costs and prices are industry benchmarks, **not Richmond quotes**. GL and workers' comp premiums and equipment rental rates move the model most; replace them with real quotes before relying on the numbers.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # pricing + financial model tests
npm run lint
npm run build
```

Stack: Next.js (App Router) + TypeScript + Tailwind. Charts are dependency-free SVG. Supabase and Vercel deployment are planned next steps; the first version runs entirely on mock data.
