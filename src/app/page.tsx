import Link from "next/link";

const DIFFERENTIATORS = [
  { title: "Price range in 60 seconds", body: "Customers describe the tree, add photos and see a price range before anyone calls them back." },
  { title: "Booked, not just quoted", body: "Every estimate ends in a booking request the GM can schedule onto one of two crews." },
  { title: "Owner sees everything", body: "Jobs, close rate, ticket size, crew utilization and cash runway in one place, without being on-site." },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-16 sm:py-24 max-w-3xl">
        <p className="text-sm font-medium text-brand">Richmond · Henrico · Chesterfield</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight text-balance">
          Tree work priced upfront, scheduled fast, done safely.
        </h1>
        <p className="mt-5 text-lg text-ink-2 max-w-2xl">
          Trimming, removal, stump grinding and storm response from two fully insured crews. Get an instant
          estimate online, with no waiting for a callback to learn the ballpark.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/quote" className="rounded-lg bg-brand px-5 py-3 font-medium text-on-brand hover:bg-brand-strong">
            Get an instant estimate
          </Link>
          <Link href="/dashboard" className="rounded-lg border border-line bg-surface px-5 py-3 font-medium hover:bg-surface-2">
            View the owner dashboard
          </Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3 pb-20">
        {DIFFERENTIATORS.map((d) => (
          <div key={d.title} className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-semibold">{d.title}</h2>
            <p className="mt-2 text-sm text-ink-2">{d.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
