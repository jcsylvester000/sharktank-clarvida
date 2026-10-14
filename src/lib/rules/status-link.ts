// Signed status links (FT-091). Production: an HMAC with a server secret and an expiry.
import { sha256 } from "@/lib/auth/crypto";

export function statusToken(refId: string): string {
  return sha256(`clarvida-status-link:${refId.toUpperCase()}`).slice(0, 16);
}
export function statusLink(refId: string): string {
  return `/partner/status/?ref=${refId}&token=${statusToken(refId)}`;
}
export function validToken(refId: string, token: string | null | undefined): boolean {
  return Boolean(token) && token === statusToken(refId);
}
