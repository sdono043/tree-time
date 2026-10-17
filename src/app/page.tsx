import Image from "next/image";
import Link from "next/link";
import hero from "../../public/images/hero-tree.jpg";
import { LeafMark } from "@/components/Logo";

const SERVICES = [
  { title: "Trimming & pruning", body: "Deadwood, roof and line clearance, crown thinning and shaping that keeps trees healthy.", icon: "M12 3v18M12 8l-4-3M12 12l5-4M12 16l-5-3" },
  { title: "Tree removal", body: "From open-lawn fells to rigging over roofs, with bucket truck or crane when the job calls for it.", icon: "M4 20h16M7 20V9l5-5 5 5v11M10 20v-5h4v5" },
  { title: "Stump grinding", body: "Ground below grade and cleaned up, ready for lawn or replanting.", icon: "M5 18h14M7 18c0-4 2-6 5-6s5 2 5 6M12 12V8" },
  { title: "Storm response", body: "Trees on homes, cars or driveways triaged first, with help on the insurance paperwork.", icon: "M13 3 6 13h5l-1 8 8-11h-5l1-7Z" },
];

const WHY = [
  { title: "A price in about a minute", body: "Describe the tree and add photos to see a price range before anyone calls you back." },
  { title: "Confirmed in writing", body: "The crew lead confirms the final price before any work starts. No surprises on the invoice." },
  { title: "Two insured crews", body: "Climber-led crews with general liability and workers' comp, working to industry safety standards." },
];

export default function Home() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <Image
          src={hero}
          alt="A broad, healthy tree standing alone in a green meadow under a clear sky"
          priority
          placeholder="blur"
          fill
          sizes="100vw"
          className="-z-10 object-cover object-[70%_center]"
        />
        {/* Wash the empty sky on the left so text stays readable over the photo. */}
        <div className="absolute inset-0 -z-10 bg-white/75 sm:bg-transparent sm:bg-[linear-gradient(90deg,rgba(255,255,255,.88)_0%,rgba(255,255,255,.6)_38%,rgba(255,255,255,0)_58%)]" aria-hidden="true" />
        <div className="mx-auto flex min-h-[560px] max-w-6xl flex-col justify-center px-4 py-20 sm:min-h-[640px]">
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-brand-strong shadow-sm">
            <LeafMark className="size-4" /> Richmond · Henrico · Chesterfield
          </p>
          <h1 className="mt-5 max-w-xl text-4xl font-extrabold leading-[1.05] text-balance sm:text-6xl">
            Healthy trees. Honest prices. Safe crews.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-ink-2">
            Trimming, removal, stump grinding and storm response. See a price range online in about a minute, with no waiting for a callback.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/quote" className="rounded-full bg-brand px-6 py-3 font-semibold text-on-brand shadow-sm hover:bg-brand-strong">
              Get an instant estimate
            </Link>
            <a href="tel:+18045550100" className="rounded-full border border-line bg-white/90 px-6 py-3 font-semibold hover:bg-white">
              Call (804) 555-0100
            </a>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <h2 className="text-3xl font-bold">What we do</h2>
        <p className="mt-2 max-w-2xl text-ink-2">Residential, HOA and commercial tree care, priced upfront.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <div key={s.title} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={s.icon} />
                </svg>
              </span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-ink-2">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface-2/70">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-bold">Why neighbors call us</h2>
            <p className="mt-2 text-ink-2">Clear pricing and careful work, from the first photo to the last raked leaf.</p>
            <Link href="/quote" className="mt-6 inline-block rounded-full bg-brand px-5 py-2.5 font-semibold text-on-brand hover:bg-brand-strong">Price my job</Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {WHY.map((w) => (
              <li key={w.title} className="rounded-2xl bg-surface p-5 shadow-sm">
                <LeafMark className="size-5" />
                <h3 className="mt-3 font-semibold">{w.title}</h3>
                <p className="mt-1.5 text-sm text-ink-2">{w.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
