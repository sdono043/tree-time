import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Richmond Tree Care Co.",
  description: "Tree trimming, removal, stump grinding and storm response across Richmond, Henrico and Chesterfield.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        <header className="border-b border-line bg-surface">
          <nav className="mx-auto max-w-6xl px-4 min-h-14 py-2 flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight flex items-center gap-2">
              <span aria-hidden className="inline-block size-6 rounded-md bg-brand" />
              Richmond Tree Care
            </Link>
            <div className="ml-auto flex items-center gap-x-4 gap-y-1 flex-wrap justify-end text-sm">
              <Link href="/quote" className="text-ink-2 hover:text-ink">Instant quote</Link>
              <Link href="/estimator" className="text-ink-2 hover:text-ink">Job estimator</Link>
              <Link href="/dashboard" className="text-ink-2 hover:text-ink">Owner dashboard</Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line text-xs text-muted">
          <div className="mx-auto max-w-6xl px-4 py-6">
            Demo build. Prices and financials are industry benchmarks, not Richmond quotes.
          </div>
        </footer>
      </body>
    </html>
  );
}
