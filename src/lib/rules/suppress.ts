// BR19 small-cell suppression: outside the Care Zone, counts 1–10 display as "<11".
export function suppress(n: number): string {
  if (n > 0 && n < 11) return "<11";
  return n.toLocaleString("en-US");
}
export function isSuppressed(n: number): boolean {
  return n > 0 && n < 11;
}
