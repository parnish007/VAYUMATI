"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Ward Pulse is now embedded inside the Exposure page (tab switcher: My Route | Ward Pulse).
// This redirect keeps old /pulse links working.
export default function PulsePage() {
  const router = useRouter();
  useEffect(() => { router.replace("/exposure"); }, [router]);
  return null;
}
