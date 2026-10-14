import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { sha256, mfaCode, verifyMfa, MFA_STEP_MS } from "./crypto";

describe("crypto", () => {
  it("matches Node's SHA-256", () => {
    for (const s of ["", "abc", "Sample-Pass1!", "x".repeat(200), "ñandú – é"]) {
      expect(sha256(s)).toBe(createHash("sha256").update(s, "utf8").digest("hex"));
    }
  });
  it("MFA accepts the current and previous code only", () => {
    const t = 1_800_000_000_000;
    expect(verifyMfa("u-maria", mfaCode("u-maria", t), t)).toBe(true);
    expect(verifyMfa("u-maria", mfaCode("u-maria", t - MFA_STEP_MS), t)).toBe(true);
    expect(verifyMfa("u-maria", mfaCode("u-maria", t - 2 * MFA_STEP_MS), t)).toBe(false);
    expect(mfaCode("u-maria", t)).toMatch(/^\d{6}$/);
    expect(mfaCode("u-maria", t)).not.toBe(mfaCode("u-jon", t));
  });
});
