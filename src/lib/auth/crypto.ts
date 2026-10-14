// Small, synchronous SHA-256 so password hashing and MFA codes work everywhere the prototype runs
// (including plain-http LAN addresses where crypto.subtle is unavailable). Production uses the
// Clarvida identity provider; nothing here is a real security control.

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function sha256(input: string): string {
  const msg = utf8(input);
  const l = msg.length;
  const withPad = ((l + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(withPad);
  buf.set(msg);
  buf[l] = 0x80;
  const bits = l * 8;
  const view = new DataView(buf.buffer);
  view.setUint32(withPad - 4, bits >>> 0);
  view.setUint32(withPad - 8, Math.floor(bits / 0x100000000));
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  for (let i = 0; i < withPad; i += 64) {
    for (let t = 0; t < 16; t++) W[t] = view.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const a = W[t - 15], b = W[t - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return Array.from(H, (x) => x.toString(16).padStart(8, "0")).join("");
}

export function hashPassword(salt: string, password: string): string {
  return sha256(`${salt}:${password}`);
}

export function randomToken(len = 24): string {
  const chars = "abcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  const rnd = typeof crypto !== "undefined" && "getRandomValues" in crypto ? crypto.getRandomValues(new Uint8Array(len)) : Array.from({ length: len }, () => Math.floor(Math.random() * 256));
  for (let i = 0; i < len; i++) out += chars[rnd[i] % chars.length];
  return out;
}

// ---------------------------------------------------------------- MFA (TOTP-style, FT-003)
export const MFA_STEP_MS = 30_000;

/** The 6-digit code for an account in a given 30-second window. */
export function mfaCode(userId: string, at: number): string {
  const window = Math.floor(at / MFA_STEP_MS);
  const h = sha256(`clarvida-demo-authenticator:${userId}:${window}`);
  const n = parseInt(h.slice(0, 8), 16) % 1_000_000;
  return String(n).padStart(6, "0");
}

/** Accepts the current code or the one immediately before it (AC-FR-03). */
export function verifyMfa(userId: string, code: string, at: number): boolean {
  const c = code.replace(/\D/g, "");
  return c === mfaCode(userId, at) || c === mfaCode(userId, at - MFA_STEP_MS);
}

export function mfaSecondsLeft(at: number): number {
  return Math.ceil((MFA_STEP_MS - (at % MFA_STEP_MS)) / 1000);
}
