// BR13 PHI guard: blocks client identifiers and clinical terms before any AI call, outreach send or note.
// Returns the category found (never the matched value) so logs and messages carry no client detail.
const PATTERNS: { category: string; rx: RegExp }[] = [
  { category: "Client or patient label", rx: /\b(client|patient)\s*:/i },
  { category: "Date of birth", rx: /\b(dob|d\.o\.b\.|date of birth|born on)\b/i },
  { category: "Date", rx: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/ },
  { category: "Diagnosis", rx: /\bdiagnos\w*/i },
  { category: "Medicaid or member ID", rx: /\b(medicaid|member)\s*(id|#|number)\b/i },
  { category: "Social Security number", rx: /\b(ssn|social security)\b|\b\d{3}-\d{2}-\d{4}\b/i },
  { category: "Clinical term", rx: /\b(adhd|ptsd|depress\w*|bipolar|schizo\w*|overdose\w*|suicid\w*|self-harm|autism diagnosis)\b/i },
];

export interface PhiResult {
  blocked: boolean;
  category?: string;
}

export function phiScan(text: string | null | undefined): PhiResult {
  const t = String(text ?? "");
  for (const p of PATTERNS) {
    if (p.rx.test(t)) return { blocked: true, category: p.category };
  }
  return { blocked: false };
}
