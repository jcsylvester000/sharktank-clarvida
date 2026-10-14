// BR03 reference numbers: REF-{state}-{sequence}. Unknown state uses XX.
export function referralId(state: string | undefined, seq: number): string {
  const s = state && /^[A-Z]{2}$/.test(state) ? state : "XX";
  return `REF-${s}-${seq}`;
}
