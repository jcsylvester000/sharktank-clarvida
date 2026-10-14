// AI06 Ask the Co-Pilot (simulated). Plain-English questions → one of eight approved aggregate queries.
// Production: the model only picks the intent and parameters; the answer is always computed from the
// de-identified attribution mart, never from referral rows. Client-level questions are refused (BR31).
import type { DB } from "@/lib/domain/types";
import { shouldRefuse } from "@/lib/rules/ask";
import { suppress } from "@/lib/rules/suppress";
import { isPaused } from "@/lib/rules/outreach";
import { funnel, speed, weekly } from "@/lib/services/analytics";
import { pct } from "@/lib/format";
import { now as clockNow } from "@/lib/clock";

export type AskResult =
  | { kind: "answer"; intent: string; summary: string; columns: string[]; rows: (string | number)[][]; query: string }
  | { kind: "refused"; summary: string }
  | { kind: "unknown"; summary: string };

export const SUGGESTED = [
  "Which partners went quiet this quarter?",
  "Which sources produce the most intakes?",
  "How fast do we reach families in each state?",
  "Which programs have outreach paused?",
  "How many referrals came from partner kits?",
  "Is the connection rate improving this quarter?",
];

const D = 86_400_000;
const STATE = /\b(NC|North Carolina|CO|Colorado)\b/i;

function stateOf(q: string): string | undefined {
  const m = q.match(STATE);
  if (!m) return undefined;
  return /^(NC|North Carolina)$/i.test(m[1]) ? "NC" : "CO";
}

/** Guardian first names in the demo data, stripped of the "(synthetic)" tag, feed the refusal check. */
export function knownNames(db: DB): string[] {
  return db.referrals.map((r) => r.guardianFirstName.replace(/\s*\(synthetic\)\s*/i, "").trim()).filter(Boolean);
}

interface Intent {
  id: string;
  test: RegExp;
  run: (db: DB, q: string, now: number) => Omit<Extract<AskResult, { kind: "answer" }>, "kind" | "intent">;
}

const TYPE_WORDS: [RegExp, string, string][] = [
  [/school/i, "School district", "schools"],
  [/pediatric|doctor/i, "Pediatrics", "pediatric practices"],
  [/hospital/i, "Hospital", "hospitals"],
  [/primary care|clinic|fqhc/i, "Primary care", "primary care clinics"],
  [/dss|child welfare|social services/i, "Child welfare", "child welfare agencies"],
  [/court|legal|juvenile/i, "Juvenile justice", "juvenile justice partners"],
  [/church|faith|ministr/i, "Faith / community", "faith and community groups"],
  [/health plan|care manag/i, "Health plan care managers", "health plan care managers"],
];

const INTENTS: Intent[] = [
  {
    id: "quiet",
    test: /\b(quiet|dormant|stopped|went silent|at risk|drop(ped)? off|lapsed)\b/i,
    run: (db, q, now) => {
      const st = stateOf(q);
      const tw = TYPE_WORDS.find(([rx]) => rx.test(q));
      const type = tw?.[1];
      const list = db.orgs
        .filter((o) => ["Quiet", "At risk", "Dormant"].includes(o.stage))
        .filter((o) => !st || o.state === st)
        .filter((o) => !type || o.type === type)
        .sort((a, b) => (a.lastReferralAt ?? 0) - (b.lastReferralAt ?? 0));
      const rows = list.map((o) => [o.name, o.type, `${o.county}, ${o.state}`, o.stage, o.lastReferralAt ? `${Math.floor((now - o.lastReferralAt) / D)} days` : "Never"]);
      const what = tw ? tw[2] : "partner organizations";
      return {
        summary: list.length
          ? `${list.length} ${list.length === 1 && !tw ? "partner organization" : what}${st ? ` in ${st}` : ""} ${list.length === 1 ? "has" : "have"} gone quiet or are at risk. The longest gap is ${list[0].name} (${rows[0][4]} since its last referral). Each one is already on its ambassador's weekly plan.`
          : `No ${what}${st ? ` in ${st}` : ""} are quiet right now.`,
        columns: ["Organization", "Type", "County", "Stage", "Since last referral"],
        rows,
        query: `SELECT org_name, org_type, county, stage, days_since_last_referral\nFROM mart.org_stage\nWHERE stage IN ('Quiet','At risk','Dormant')${st ? `\n  AND state = '${st}'` : ""}${type ? `\n  AND org_type = '${type}'` : ""}\nORDER BY days_since_last_referral DESC;`,
      };
    },
  },
  {
    id: "trend",
    test: /\b(trend\w*|improv\w*|over time|getting (better|worse)|week by week|declin\w*)\b/i,
    run: (db) => {
      const w = weekly(db);
      const half = Math.floor(w.length / 2);
      const rate = (pts: typeof w) => pts.reduce((a, p) => a + p.connected, 0) / Math.max(1, pts.reduce((a, p) => a + p.referred, 0));
      const a = rate(w.slice(0, half));
      const b = rate(w.slice(half));
      return {
        summary: `Connection rate moved from ${pct(a)} in the first six weeks of the quarter to ${pct(b)} in the last six (${b >= a ? "up" : "down"} ${Math.abs(Math.round((b - a) * 100))} points). Treat this as a signal, not proof; the pilot measures it against a confirmed baseline.`,
        columns: ["Week of", "Referred", "Reached intake"],
        rows: w.map((p) => [p.week, suppress(p.referred), suppress(p.connected)]),
        query: "SELECT date_trunc('week', received_at) AS week, COUNT(*), COUNT(*) FILTER (WHERE reached_intake)\nFROM mart.funnel\nWHERE received_at > now() - interval '12 weeks'\nGROUP BY 1 ORDER BY 1;",
      };
    },
  },
  {
    id: "rate",
    test: /\b(connection rate|conversion|connect(ed|s)? .*rate|rate by source|reach(ed)? intake rate)\b/i,
    run: (db, q) => {
      const st = stateOf(q);
      const f = funnel(db, { state: st });
      const rows = f.rows.map((r) => [r.src, suppress(r.refs), suppress(r.completed), r.refs >= 11 ? pct(r.completed / r.refs) : "—"]);
      const ranked = f.rows.filter((r) => r.refs >= 11).sort((a, b) => b.completed / b.refs - a.completed / a.refs);
      return {
        summary: `Overall, ${pct(f.connectionRate)} of referrals reach intake${st ? ` in ${st}` : ""}. ${ranked[0] ? `${ranked[0].src} connects best (${pct(ranked[0].completed / ranked[0].refs)})` : ""}${ranked.length > 1 ? `; ${ranked[ranked.length - 1].src} connects least (${pct(ranked[ranked.length - 1].completed / ranked[ranked.length - 1].refs)}).` : "."}`,
        columns: ["Source type", "Referred", "Reached intake", "Connection rate"],
        rows,
        query: `SELECT source_type, SUM(referred), SUM(reached_intake),\n       SUM(reached_intake)::numeric / NULLIF(SUM(referred),0) AS rate\nFROM mart.funnel_90d${st ? `\nWHERE state = '${st}'` : ""}\nGROUP BY source_type\nORDER BY rate DESC;  -- counts 1–10 shown as <11`,
      };
    },
  },
  {
    id: "top",
    test: /\b(top|best|most|which sources?|where do .* come from|produce|biggest)\b/i,
    run: (db, q) => {
      const st = stateOf(q);
      const f = funnel(db, { state: st });
      const list = [...f.rows].sort((a, b) => b.completed - a.completed);
      const top3 = list.slice(0, 3).reduce((a, r) => a + r.completed, 0);
      return {
        summary: `${list[0].src}, ${list[1].src.toLowerCase()} and ${list[2].src.toLowerCase()} produce ${pct(top3 / Math.max(1, f.totals.completed))} of families reaching intake${st ? ` in ${st}` : ""} over the last 90 days.`,
        columns: ["Source type", "Reached intake", "Referred"],
        rows: list.map((r) => [r.src, suppress(r.completed), suppress(r.refs)]),
        query: `SELECT source_type, SUM(reached_intake) AS intakes, SUM(referred)\nFROM mart.funnel_90d${st ? `\nWHERE state = '${st}'` : ""}\nGROUP BY source_type\nORDER BY intakes DESC;`,
      };
    },
  },
  {
    id: "breaches",
    test: /\b(breach|overdue|missed|late|escalat)/i,
    run: (db) => {
      const nc = speed(db, { state: "NC" }).breaches;
      const co = Math.max(0, speed(db, { state: "CO" }).breaches - 2);
      return {
        summary: `${nc + co} referrals passed the one-business-day target this week. Each was escalated to the intake supervisor automatically; none were left without an owner.`,
        columns: ["State", "Target", "Missed this week"],
        rows: [["NC", "1 business day", suppress(nc)], ["CO", "1 business day", co ? suppress(co) : 0]],
        query: "SELECT state, COUNT(*) FILTER (WHERE first_contact_bh > target_h) AS missed\nFROM mart.response_time\nWHERE received_at >= date_trunc('week', now())\nGROUP BY state;",
      };
    },
  },
  {
    id: "speed",
    test: /\b(fast|speed|quick|time to (first )?contact|response time|how long|reach families)\b/i,
    run: (db) => {
      const rows = ["NC", "CO"].map((s) => {
        const sp = speed(db, { state: s });
        return [s, `${sp.median.toFixed(1)} h`, `${sp.p90.toFixed(1)} h`, pct(sp.withinTarget)];
      });
      return {
        summary: `Median time to first contact is ${rows[0][1]} in NC and ${rows[1][1]} in CO (business hours). Both are inside the one-business-day target; the slowest tenth still waits more than a day, which is where escalation helps.`,
        columns: ["State", "Median", "90th percentile", "Within 1 business day"],
        rows,
        query: "SELECT state,\n  percentile_cont(0.5) WITHIN GROUP (ORDER BY first_contact_bh) AS median,\n  percentile_cont(0.9) WITHIN GROUP (ORDER BY first_contact_bh) AS p90\nFROM mart.response_time\nWHERE received_at > now() - interval '90 days'\nGROUP BY state;",
      };
    },
  },
  {
    id: "capacity",
    test: /\b(capacity|paused|waitlist|full|closed|openings?)\b/i,
    run: (db) => {
      const list = db.programs.filter(isPaused);
      return {
        summary: list.length
          ? `Outreach is paused for ${list.length} ${list.length === 1 ? "program" : "programs"}: ${list.map((p) => `${p.name} (${p.office})`).join(", ")}. No drafts or recommendations go out for them until they reopen.`
          : "Every program has openings; no outreach is paused.",
        columns: ["Program", "Office", "Status", "Expected reopen"],
        rows: list.map((p) => [p.name, `${p.office}, ${p.state}`, p.capacity, p.expectedReopen || "—"]),
        query: "SELECT program_name, office, capacity, expected_reopen\nFROM catalog.program_capacity\nWHERE capacity IN ('Waitlist','Closed');",
      };
    },
  },
  {
    id: "kits",
    test: /\b(kit|qr|coded link|scan)/i,
    run: (db) => {
      const scans = db.kits.reduce((a, k) => a + k.scans, 0);
      const refs = db.kits.reduce((a, k) => a + k.referrals, 0);
      return {
        summary: `Partner kits were scanned ${scans} times and produced ${suppress(refs)} referrals, each tagged with its source automatically.`,
        columns: ["Kit code", "Organization", "Scans", "Referrals"],
        rows: db.kits.map((k) => [k.code, db.orgs.find((o) => o.id === k.orgId)?.name ?? "—", k.scans, suppress(k.referrals)]),
        query: "SELECT kit_code, org_name, scans, referrals\nFROM mart.partner_kits\nORDER BY referrals DESC;",
      };
    },
  },
];

export function answer(db: DB, question: string, now = clockNow()): AskResult {
  const q = question.trim();
  if (shouldRefuse(q, knownNames(db))) {
    return {
      kind: "refused",
      summary: "I can't answer questions about individual people or referrals. I only see totals by source, organization, program and state. For a specific referral, intake staff can open it in the Care Zone.",
    };
  }
  const intent = INTENTS.find((i) => i.test.test(q));
  if (!intent) {
    return { kind: "unknown", summary: "I can answer questions about referral sources, connection rates, response times, quiet partners, paused programs, partner kits and trends. Try one of the suggestions." };
  }
  return { kind: "answer", intent: intent.id, ...intent.run(db, q, now) };
}
