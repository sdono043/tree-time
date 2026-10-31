"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Logo";

const TEAM_PATHS = ["/estimator", "/estimates", "/dashboard"];
const TEAM_LINKS = [
  { href: "/estimator", label: "Estimator" },
  { href: "/estimates", label: "Estimates" },
  { href: "/dashboard", label: "Dashboard" },
];

export function SiteHeader() {
  const path = usePathname() ?? "/";
  const team = TEAM_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
        <Link href="/" aria-label="Richmond Tree Care home">
          <Wordmark />
        </Link>
        {team ? (
          <div className="ml-auto flex items-center gap-1 text-sm">
            <span className="mr-2 hidden rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-strong sm:inline">Team</span>
            {TEAM_LINKS.map((l) => {
              const active = path === l.href || path.startsWith(`${l.href}/`);
              return (
                <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={`rounded-md px-2.5 py-1.5 ${active ? "bg-brand-soft font-medium text-brand-strong" : "text-ink-2 hover:text-ink"}`}>
                  {l.label}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="ml-auto flex items-center gap-4 text-sm">
            <Link href="/#services" className="hidden text-ink-2 hover:text-ink sm:inline">Services</Link>
            <Link href="/leaf-pickup" className={`hidden sm:inline ${path.startsWith("/leaf-pickup") ? "font-medium text-brand-strong" : "text-ink-2 hover:text-ink"}`}>Leaf pickup</Link>
            <a href="tel:+18045550100" className="hidden text-ink-2 hover:text-ink sm:inline">(804) 555-0100</a>
            <Link href="/quote" className="rounded-full bg-brand px-4 py-2 font-medium text-on-brand hover:bg-brand-strong">Instant estimate</Link>
          </div>
        )}
      </nav>
    </header>
  );
}
