import type { Metadata } from "next";
import Link from "next/link";
import { EstimateDetail } from "@/components/EstimateDetail";

export const metadata: Metadata = {
  title: "Estimate · Richmond Tree Care Co.",
  robots: { index: false, follow: false },
};

export default async function EstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/estimates" className="text-sm text-muted hover:text-ink">← All estimates</Link>
      <div className="mt-4">
        <EstimateDetail id={id} />
      </div>
    </div>
  );
}
