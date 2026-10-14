// BR31 Ask the Co-Pilot refusal: never answer questions about individual people or referrals.
const PERSONAL = [
  /\bREF-[A-Z]{2}-\d+/i,
  /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,
  /\b(guardian|patient|client|family name|phone number|address|date of birth|dob|diagnos\w*)\b/i,
  /\bwho (was|were|got|is being) referred\b/i,
  /\b(tell me about|details (on|for|about)|what happened to)\s+[A-Z][a-z]+\b/,
];

export function shouldRefuse(question: string, knownFirstNames: string[] = []): boolean {
  const q = question.trim();
  if (!q) return false;
  if (PERSONAL.some((rx) => rx.test(q))) return true;
  const lower = q.toLowerCase();
  return knownFirstNames.some((n) => n && new RegExp(`\\b${n.toLowerCase()}\\b`).test(lower));
}
