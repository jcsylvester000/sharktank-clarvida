"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** v2 route kept for old links: sign-in is now the front door at "/". */
export default function LegacySignIn() {
  const router = useRouter();
  useEffect(() => { router.replace("/" + window.location.search); }, [router]);
  return null;
}
