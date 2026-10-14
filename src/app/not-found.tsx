import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cv-ice px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-color.png" alt="Clarvida" width={170} height={46} />
      <h1 className="mt-8 text-[1.9rem] text-cv-teal">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-ink-2">The link may be old, or the page may have moved. Your dashboard has everything you need.</p>
      <Link href="/app/" className="mt-6 inline-flex h-12 items-center rounded-full bg-cv-amber px-6 font-semibold text-cv-ink hover:bg-[#f2aa00]">Go to my dashboard ›</Link>
      <p className="mt-10 text-xs text-ink-3">Prototype with synthetic data. No real people or clients.</p>
    </main>
  );
}
