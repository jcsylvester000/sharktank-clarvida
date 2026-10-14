"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LocateFixed, MapPin } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { milesBetween, orgPoint, type LatLng } from "@/lib/geo";
import { phiScan } from "@/lib/rules/phi";
import { checkIn, CHECKIN_RADIUS_MI, recordBlocked } from "@/lib/services/outreach";
import { Button } from "@/components/ui/button";
import { Label, Textarea, FieldError } from "@/components/ui/field";
import { Dialog } from "@/components/ui/overlays";
import { cn } from "@/components/ui/cn";

/** FT-175: check in at a visit. Location is read once, now, only with permission; without it, check in at the address. */
export function CheckInDialog({ orgId, onClose }: { orgId: string | null; onClose: () => void }) {
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const org = db.orgs.find((o) => o.id === orgId);
  const [where, setWhere] = useState<{ method: "location" | "address" | "demo"; distanceMi: number | null } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setWhere(null); setStatus(null); setNote(""); setErr(null); }, [orgId]);
  if (!org) return null;
  const site: LatLng = orgPoint(org);

  const useLocation = () => {
    if (!("geolocation" in navigator)) { setStatus("This browser can't share location. Check in at the organization's address instead."); return; }
    setStatus("Asking your browser for your location (one reading only)…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = milesBetween({ lat: pos.coords.latitude, lng: pos.coords.longitude }, site);
        if (dist <= CHECKIN_RADIUS_MI) { setWhere({ method: "location", distanceMi: dist }); setStatus(`Location confirmed: ${dist.toFixed(2)} miles from the site.`); }
        else setStatus(`You're ${dist < 50 ? dist.toFixed(1) : "more than 50"} miles from this organization, so we can't confirm the visit by location. Use the address, or the demo location for the pitch.`);
      },
      () => setStatus("Location wasn't shared. That's fine: check in at the organization's address instead."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Check in at ${org.name.split(",")[0]}`}
      description="We read your location once, right now, and only if you allow it. There is no tracking in the background."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="cta" disabled={!where} onClick={() => {
            const phi = phiScan(note);
            if (phi.blocked) { mutate((d) => recordBlocked(d, { objectId: org.id, category: phi.category!, where: "a visit note" })); setErr(`Blocked: possible client details (${phi.category}). Visit notes are about the organization only.`); return; }
            mutate((d) => checkIn(d, { orgId: org.id, method: where!.method, distanceMi: where!.distanceMi, outcome: note.trim() || "Visit" }));
            toast.success("Checked in", { description: "The visit is on the map and the organization's timeline. A follow-up task was added." });
            onClose();
          }}>Check in</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="secondary" size="sm" onClick={useLocation}><LocateFixed size={14} /> Use my location</Button>
          <Button variant="secondary" size="sm" onClick={() => { setWhere({ method: "address", distanceMi: null }); setStatus("Checking in at the organization's address."); }}><MapPin size={14} /> Use the address</Button>
          <Button variant="secondary" size="sm" onClick={() => { const d = 0.04 + Math.random() * 0.08; setWhere({ method: "demo", distanceMi: d }); setStatus(`Demo location: ${d.toFixed(2)} miles from the site (within ${CHECKIN_RADIUS_MI} mi).`); }} data-guide="demo-location">Demo location</Button>
        </div>
        {status ? <p className={cn("rounded-xl px-3 py-2 text-sm", where ? "bg-teal-tint text-teal-strong" : "bg-sunken text-ink-2")} role="status">{status}</p> : null}
        <div>
          <Label htmlFor="ci-note">What happened (optional)</Label>
          <Textarea id="ci-note" value={note} onChange={(e) => { setNote(e.target.value); setErr(null); }} placeholder="e.g. Met the new care manager; send the program list" className="mt-1" />
          <FieldError>{err}</FieldError>
        </div>
      </div>
    </Dialog>
  );
}

