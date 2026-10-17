import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";
import { AS_OF } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "Owner dashboard · Richmond Tree Care Co.",
};

export default function DashboardPage() {
  const asOf = new Date(AS_OF).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Owner dashboard</h1>
          <p className="mt-1 text-ink-2">As of {asOf} · Month 7 of Year 1</p>
        </div>
        <span className="rounded-full border border-warn/40 bg-warn-soft px-3 py-1 text-xs font-medium">Demo data</span>
      </div>
      <div className="mt-8">
        <Dashboard />
      </div>
    </div>
  );
}
