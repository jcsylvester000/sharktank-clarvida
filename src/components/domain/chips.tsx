import { AlertTriangle, CircleCheck, CircleDot, CirclePause, CornerUpRight, Lock, OctagonX, Clock3, Hourglass } from "lucide-react";
import type { Capacity, ReferralStatus, Stage, Tier1Status, Zone } from "@/lib/domain/types";
import { Badge, type Tone } from "@/components/ui/badge";
import { statusLabel } from "@/lib/rules/status";

const STATUS_TONE: Record<ReferralStatus, Tone> = {
  New: "teal",
  Contacted: "neutral",
  Accepted: "ok",
  Hold: "warn",
  Redirected: "neutral",
  "Intake scheduled": "ok",
  "Intake completed": "ok",
  Closed: "outline",
};

export function StatusChip({ status }: { status: ReferralStatus }) {
  const icon =
    status === "Hold" ? <CirclePause size={12} /> : status === "Redirected" ? <CornerUpRight size={12} /> : status === "Closed" ? <OctagonX size={12} /> : status === "New" ? <CircleDot size={12} /> : <CircleCheck size={12} />;
  return <Badge tone={STATUS_TONE[status]} icon={icon}>{statusLabel(status)}</Badge>;
}

const TIER1_TONE: Record<Tier1Status, Tone> = { Received: "teal", "In outreach": "ok", "On hold": "warn", Redirected: "neutral", Closed: "outline" };
export function Tier1Chip({ status }: { status: Tier1Status }) {
  return <Badge tone={TIER1_TONE[status]}>{status}</Badge>;
}

const STAGE_TONE: Record<Stage, Tone> = { Active: "ok", Engaged: "ok", New: "outline", Quiet: "warn", "At risk": "crit", Dormant: "crit" };
export function StageChip({ stage }: { stage: Stage }) {
  return <Badge tone={STAGE_TONE[stage]} icon={stage === "At risk" ? <AlertTriangle size={12} /> : undefined}>{stage}</Badge>;
}

const CAP_TONE: Record<Capacity, Tone> = { Open: "ok", Limited: "warn", Waitlist: "crit", Closed: "crit" };
export function CapacityChip({ capacity, stale }: { capacity: Capacity; stale?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={CAP_TONE[capacity]} icon={capacity === "Open" ? <CircleCheck size={12} /> : capacity === "Limited" ? <Hourglass size={12} /> : <CirclePause size={12} />}>
        {capacity}
      </Badge>
      {stale ? <Badge tone="hl" icon={<Clock3 size={12} />}>Stale</Badge> : null}
    </span>
  );
}

export function ZoneBadge({ zone, compact }: { zone: Zone; compact?: boolean }) {
  if (zone === "Care") return <Badge tone="care" icon={<Lock size={12} />}>{compact ? "Care Zone" : "Care Zone: client data"}</Badge>;
  if (zone === "Outreach") return <Badge tone="teal">{compact ? "Outreach Zone" : "Outreach Zone: no client data"}</Badge>;
  if (zone === "Both") return <Badge tone="outline">{compact ? "Both zones" : "Both zones: status and counts only"}</Badge>;
  if (zone === "External") return <Badge tone="outline">Partner portal</Badge>;
  return <Badge tone="outline">{zone}</Badge>;
}

export function DataClassChip({ cls, title }: { cls: string; title?: string }) {
  return (
    <Badge tone="outline" title={title} className="font-mono text-[0.7rem]">
      {cls}
    </Badge>
  );
}
