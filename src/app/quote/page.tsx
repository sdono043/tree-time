import type { Metadata } from "next";
import { QuoteEstimator } from "@/components/QuoteEstimator";

export const metadata: Metadata = {
  title: "Instant estimate · Richmond Tree Care Co.",
  description: "See a price range for tree trimming, removal or stump grinding in about a minute.",
};

export default function QuotePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Instant estimate</h1>
      <p className="mt-2 text-ink-2 max-w-2xl">
        Tell us about the tree and see a price range right away. Most estimates are confirmed from photos, without a site visit.
      </p>
      <div className="mt-8">
        <QuoteEstimator />
      </div>
    </div>
  );
}
