import type { Metadata } from "next";
import Link from "next/link";
import { EstimatesList } from "@/components/EstimatesList";

export const metadata: Metadata = {
  title: "Estimates · Richmond Tree Care Co.",
  robots: { index: false, follow: false },
};

export default function EstimatesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Estimates</h1>
          <p className="mt-1 text-ink-2">Every photo analysis, with what was quoted and how it turned out.</p>
        </div>
        <Link href="/estimator" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-strong">New estimate</Link>
      </div>
      <div className="mt-8">
        <EstimatesList />
      </div>
    </div>
  );
}
