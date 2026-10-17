/** Leaf mark: a single leaf with a midrib and veins. */
export function LeafMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M6 27C5 15 13 5 27 4c1 13-8 23-21 23Z" fill="var(--brand)" />
      <path d="M6 27c5-7 10-12 17-18M12 20.5l-.5-5M16.5 16.5l-.5-5.5M12 20.5l5 .5M16.5 16.5l5.5.5" stroke="var(--brand-soft)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <LeafMark />
      <span className="leading-tight">
        <span className="block font-bold tracking-tight">Richmond Tree Care</span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Tree care · Richmond, VA</span>
      </span>
    </span>
  );
}
