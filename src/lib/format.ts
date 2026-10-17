export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const usdK = (n: number) => {
  const abs = Math.abs(n);
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(abs >= 100_000 ? 0 : 1)}K` : `$${Math.round(abs)}`;
  return n < 0 ? `−${s}` : s;
};

export const pct = (n: number) => `${Math.round(n * 100)}%`;
