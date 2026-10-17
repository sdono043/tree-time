import type { Metadata } from "next";
import { JobEstimator } from "@/components/JobEstimator";

export const metadata: Metadata = {
  title: "Job estimator · Richmond Tree Care Co.",
  robots: { index: false, follow: false },
};

export default function EstimatorPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Job estimator</h1>
          <p className="mt-1 text-ink-2 max-w-2xl">
            Upload the customer&apos;s photos. AI reads the job; the company&apos;s rate card prices it. Review, correct, then send.
          </p>
        </div>
        <span className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-medium">GM tool</span>
      </div>
      <div className="mt-8">
        <JobEstimator />
      </div>
    </div>
  );
}
