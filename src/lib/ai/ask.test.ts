import { describe, expect, it } from "vitest";
import { makeSeed } from "@/lib/data/seed";
import { answer, SUGGESTED } from "./ask";

const db = makeSeed(Date.now());

describe("Ask the Co-Pilot (AI06)", () => {
  it("answers every suggested question with a table and query", () => {
    for (const q of SUGGESTED) {
      const r = answer(db, q);
      expect(r.kind, q).toBe("answer");
      if (r.kind === "answer") {
        expect(r.rows.length, q).toBeGreaterThan(0);
        expect(r.query.length).toBeGreaterThan(10);
      }
    }
  });

  it("routes suggestions to the right intent", () => {
    const ids = SUGGESTED.map((q) => { const r = answer(db, q); return r.kind === "answer" ? r.intent : r.kind; });
    expect(ids).toEqual(["quiet", "top", "speed", "capacity", "kits", "trend"]);
  });

  it("refuses client-level questions, including synthetic guardian names", () => {
    expect(answer(db, "What's the phone number for the family referred by Gaston Schools?").kind).toBe("refused");
    expect(answer(db, "Did Morgan get an appointment?").kind).toBe("refused");
    expect(answer(db, "Show REF-NC-24811").kind).toBe("refused");
  });

  it("filters quiet partners by state and type", () => {
    const r = answer(db, "Which child welfare partners in NC went quiet?");
    expect(r.kind).toBe("answer");
    if (r.kind === "answer") expect(r.rows.every((row) => row[1] === "Child welfare" && String(row[2]).endsWith("NC"))).toBe(true);
  });

  it("suppresses small counts", () => {
    const r = answer(db, "Which sources produce the most intakes?");
    if (r.kind === "answer") expect(r.rows.some((row) => row.includes("<11"))).toBe(true);
  });

  it("says what it can do when it does not understand", () => {
    expect(answer(db, "Tell a joke").kind).toBe("unknown");
  });
});
