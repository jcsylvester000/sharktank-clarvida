"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** v2 route kept for old links: My Week now lives on the role-aware dashboard. */
export default function Home() {
  const router = useRouter();
  useEffect(() => { router.replace("/app/"); }, [router]);
  return null;
}
