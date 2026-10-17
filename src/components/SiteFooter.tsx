import Link from "next/link";
import { Wordmark } from "./Logo";

/** Footer with a meadow edge along the top. */
export function SiteFooter() {
  return (
    <footer className="mt-16">
      <svg viewBox="0 0 1440 40" preserveAspectRatio="none" className="block h-6 w-full sm:h-10" aria-hidden="true">
        <path d="M0 40V22C120 14 240 28 360 20S600 10 720 18 960 30 1080 20 1320 12 1440 20V40Z" fill="var(--brand-soft)" />
        <path d="M0 40V30C160 24 320 34 480 28S800 22 960 30 1280 34 1440 28V40Z" fill="#cfe5c3" />
      </svg>
      <div className="bg-[#cfe5c3]/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3">
          <div className="space-y-2">
            <Wordmark />
            <p className="text-ink-2">Trimming, removal, stump grinding and storm response across Richmond, Henrico and Chesterfield. Fully insured.</p>
          </div>
          <div>
            <h2 className="font-semibold">Customers</h2>
            <ul className="mt-2 space-y-1 text-ink-2">
              <li><Link href="/quote" className="hover:text-ink">Instant estimate</Link></li>
              <li><Link href="/#services" className="hover:text-ink">Services</Link></li>
              <li><a href="tel:+18045550100" className="hover:text-ink">(804) 555-0100</a></li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold">Team</h2>
            <ul className="mt-2 space-y-1 text-ink-2">
              <li><Link href="/estimator" className="hover:text-ink">Job estimator</Link></li>
              <li><Link href="/estimates" className="hover:text-ink">Estimates</Link></li>
              <li><Link href="/dashboard" className="hover:text-ink">Owner dashboard</Link></li>
            </ul>
          </div>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted">Demo build. Prices and financials are industry benchmarks, not Richmond quotes.</p>
      </div>
    </footer>
  );
}
