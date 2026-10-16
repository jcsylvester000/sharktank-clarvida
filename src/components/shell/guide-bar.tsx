"use client";
import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X, Minimize2 } from "lucide-react";
import { useState } from "react";
import { stepsFor, type Tour } from "@/lib/demo/steps";
import { ACCOUNTS } from "@/lib/data/accounts";
import { ROLE_LABEL } from "@/lib/access";
import { cn } from "@/components/ui/cn";
import { onRemoteChange, useStore } from "@/lib/store/db";
import { href, normalizePath } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/services/core";

export function stepHref(n: number, lastRef?: string, tour?: Tour): string {
  const s = stepsFor(tour)[n];
  const q = s.query ? Object.fromEntries(Object.entries(s.query).map(([k, v]) => [k, v === "LATEST" ? lastRef ?? "REF-NC-24811" : v])) : undefined;
  return s.route === "/" ? (q ? `/?${new URLSearchParams(q)}` : "/") : href(s.route, q);
}

export function useGuide() {
  const router = useRouter();
  const mutate = useStore((s) => s.mutate);
  const go = useCallback(
    (i: number, tour?: Tour) => {
      const t: Tour = tour ?? useStore.getState().db.demo.tour ?? "pitch";
      const steps = stepsFor(t);
      const idx = Math.max(0, Math.min(steps.length - 1, i));
      const s = steps[idx];
      let last: string | undefined;
      (window as unknown as { __cvGuideNav?: number }).__cvGuideNav = Date.now();
      useStore.getState().mutate((d) => {
        d.demo.guideOn = true;
        d.demo.tour = t;
        d.demo.step = idx;
        if (s.userId && d.session?.userId !== s.userId) signIn(d, s.userId, "guided", true);
        last = d.demo.lastPartnerRef;
      }, undefined, { allowReadOnly: true });
      router.push(stepHref(idx, last, t));
    },
    [mutate, router],
  );
  const exit = useCallback(() => { mutate((d) => { d.demo.guideOn = false; }, undefined, { allowReadOnly: true }); }, [mutate]);
  return { go, exit };
}

/** Bottom bar for the guided demo (PG00 F8). Highlights the step's target on the page. */
export function GuideBar() {
  const demo = useStore((s) => s.db.demo);
  const live = useStore((s) => Boolean(s.db.live));
  const pathname = usePathname();
  const { go, exit } = useGuide();
  const [collapsed, setCollapsed] = useState(false);
  const STEPS = stepsFor(demo.tour);
  const step = STEPS[demo.step];
  const onStepPage = step && normalizePath(pathname) === normalizePath(step.route);

  useEffect(() => {
    if (!demo.guideOn || !onStepPage) return;
    // Pages load behind a short simulated request, so look for the target for up to 3 seconds.
    let el: Element | null = null;
    let tries = 0;
    const t = setInterval(() => {
      el = document.querySelector(`[data-guide="${step.target}"]`);
      if (el || ++tries > 15) {
        clearInterval(t);
        if (el) {
          el.classList.add("guide-highlight");
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
    }, 200);
    return () => {
      clearInterval(t);
      el?.classList.remove("guide-highlight");
    };
  }, [demo.guideOn, demo.step, onStepPage, step]);

  // Presenter keyboard control (E02).
  useEffect(() => {
    if (!demo.guideOn) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!demo.presenter) return;
      if (e.key === "ArrowRight") go(demo.step + 1);
      if (e.key === "ArrowLeft") go(demo.step - 1);
      if (e.key === "Escape") exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demo.guideOn, demo.presenter, demo.step, go, exit]);

  // Speaker-notes window drives the presenter window (E02): follow its step, switching persona locally.
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined" || window.name === "partner" || window.name === "speaker") return;
    return onRemoteChange((m) => {
      if (m.action !== "guide-step") return;
      const st = useStore.getState();
      const s = stepsFor(st.db.demo.tour)[st.db.demo.step];
      if (!s) return;
      (window as unknown as { __cvGuideNav?: number }).__cvGuideNav = Date.now();
      if (s.userId && st.db.session?.userId !== s.userId) st.mutate((d) => signIn(d, s.userId!, "guided", true), undefined, { allowReadOnly: true });
      router.push(stepHref(st.db.demo.step, st.db.demo.lastPartnerRef, st.db.demo.tour));
    });
  }, [router]);

  useEffect(() => {
    document.body.style.paddingBottom = demo.guideOn && !collapsed ? "150px" : "";
  }, [demo.guideOn, collapsed]);

  // Windows opened as the "partner" device (live handoff) never show the presenter's guide bar. The Live sandbox has no script.
  if (live || !demo.guideOn || !step || (typeof window !== "undefined" && (window.name === "partner" || window.name === "speaker"))) return null;

  if (collapsed) {
    return (
      <button onClick={() => setCollapsed(false)} className="no-print fixed bottom-4 right-4 z-40 rounded-full bg-cv-navy px-4 py-2 text-sm font-medium text-white shadow-lg">
        {demo.tour === "journey" ? "Follow one referral" : "Guided demo"}: step {step.n} of {STEPS.length}
      </button>
    );
  }

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-ink/20 bg-cv-navy text-white" role="region" aria-label="Guided demo" data-tour={demo.tour ?? "pitch"}>
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 shrink-0 rounded bg-white/10 px-2 py-0.5 font-mono text-xs tabular">
            {step.n} / {STEPS.length}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{step.title}</p>
            <p className="text-sm text-white/80">{step.narration}</p>
          </div>
        </div>
        <AccountRail steps={STEPS} current={demo.step} journey={demo.tour === "journey"} />
        <div className="flex items-center gap-2">
          {!onStepPage ? (
            <Button size="sm" variant="secondary" onClick={() => go(demo.step)}>
              Go to this step
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => go(demo.step - 1)} disabled={demo.step === 0}>
            <ChevronLeft size={16} /> Back
          </Button>
          <Button size="sm" onClick={() => (demo.step === STEPS.length - 1 ? exit() : go(demo.step + 1))} variant="cta" chevron={false}>
            {demo.step === STEPS.length - 1 ? "Finish" : "Next"} <ChevronRight size={16} />
          </Button>
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setCollapsed(true)} aria-label="Collapse guide">
            <Minimize2 size={16} />
          </Button>
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={exit} aria-label="Exit guided demo">
            <X size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

const who = (id: string | null) => (id ? ACCOUNTS.find((a) => a.id === id) : undefined);

/** "Now viewing as" chip and the strip of accounts the tour passes through, so viewers always know whose screen this is. */
function AccountRail({ steps, current, journey }: { steps: ReturnType<typeof stepsFor>; current: number; journey: boolean }) {
  const step = steps[current];
  const me = who(step.userId);
  const order: (string | null)[] = [];
  for (const s of steps) if (!order.includes(s.userId)) order.push(s.userId);
  return (
    <div className="order-last flex w-full flex-wrap items-center gap-3 border-t border-white/10 pt-2" data-guide="account-rail">
      <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs">
        <span className="text-white/70">Now viewing as</span>
        <span className="font-semibold">{me ? `${me.name} · ${ROLE_LABEL[me.role]}` : "Public page (no sign-in)"}</span>
        {journey && step.does ? <span className="hidden text-cv-amber sm:inline">· {step.does}</span> : null}
      </span>
      <ol className="flex flex-wrap items-center gap-1" aria-label="Accounts in this tour">
        {order.map((id, i) => {
          const a = who(id);
          const on = id === step.userId;
          return (
            <li key={id ?? "public"} className="flex items-center gap-1">
              {i ? <span aria-hidden className="text-white/30">›</span> : null}
              <span title={a ? `${a.name}, ${ROLE_LABEL[a.role]}` : "Public page"} className={cn("grid size-7 place-items-center rounded-full text-[0.65rem] font-semibold", on ? "bg-cv-amber text-cv-navy ring-2 ring-white" : "bg-white/15 text-white/80")}>
                {a ? a.initials : "—"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
