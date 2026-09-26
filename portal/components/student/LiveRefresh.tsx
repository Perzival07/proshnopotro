"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps an open student page up to date. Every so often, and whenever the tab
 * comes back into view, it asks the server for a fingerprint of what the page
 * shows; only when that has changed does it redraw. So a test a tutor has just
 * assigned appears without a manual refresh, and the page does not flicker the
 * rest of the time.
 */
export function LiveRefresh({ everyMs = 20_000 }: { everyMs?: number }) {
  const router = useRouter();
  const last = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;

    const check = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/dashboard-signature", { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return;
        const { signature } = (await res.json()) as { signature: string | null };
        if (signature === null) return;
        // The first answer is what the page was built from (or very nearly);
        // later differences mean something changed.
        if (last.current !== null && signature !== last.current) router.refresh();
        last.current = signature;
      } catch {
        // Offline or a blip: try again at the next tick.
      }
    };

    void check();
    const timer = window.setInterval(check, everyMs);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router, everyMs]);

  return null;
}
