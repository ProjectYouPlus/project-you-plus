"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const PAGE_WINDOW_MS = 5 * 60 * 1000;

export function ActivityTracker() {
  return null;

  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/owner")) return;

    const now = Date.now();
    const sessionKey = "pyplus:session-started";
    const pageKey = `pyplus:page:${pathname}`;

    try {
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, String(now));
        void sendEvent("session_start", pathname);
      }

      const previous = Number(sessionStorage.getItem(pageKey) ?? 0);
      if (lastPathRef.current !== pathname && now - previous > PAGE_WINDOW_MS) {
        sessionStorage.setItem(pageKey, String(now));
        void sendEvent("page_view", pathname);
      }
    } catch {
      if (lastPathRef.current !== pathname) void sendEvent("page_view", pathname);
    }

    lastPathRef.current = pathname;
  }, [pathname]);

  return null;
}

async function sendEvent(eventName: "session_start" | "page_view", path: string) {
  try {
    await fetch("/api/activity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName, path }),
      keepalive: true,
    });
  } catch {
    // Analytics must never interrupt the product experience.
  }
}
