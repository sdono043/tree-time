import type { Metadata } from "next";
import Image from "next/image";
import hero from "../../../public/images/hero-tree.jpg";
import { QuoteEstimator } from "@/components/QuoteEstimator";

export const metadata: Metadata = {
  title: "Instant estimate · Richmond Tree Care Co.",
  description: "See a price range for tree trimming, removal or stump grinding in about a minute.",
};

export default function QuotePage() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <Image src={hero} alt="" priority placeholder="blur" fill sizes="100vw" className="-z-10 object-cover object-[70%_35%]" />
        <div className="absolute inset-0 -z-10 bg-white/75 sm:bg-transparent sm:bg-[linear-gradient(90deg,rgba(255,255,255,.9)_0%,rgba(255,255,255,.65)_40%,rgba(255,255,255,.1)_70%)]" aria-hidden="true" />
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h1 className="text-4xl font-extrabold">Instant estimate</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-2">
            Tell us about the tree and see a price range right away. Request a firm quote and we call within one business day. Nothing is scheduled until you approve the price.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <QuoteEstimator />
      </div>
    </>
  );
}
