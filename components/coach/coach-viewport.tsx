"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function CoachViewport({ children }: { children: ReactNode }) {
  const [frame, setFrame] = useState<{ height: number; keyboard: boolean } | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const viewport = window.visualViewport;
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    let keyboardHeight = 0;
    const update = () => {
      if (!media.matches) {
        setFrame(null);
        document.body.style.overflow = previousOverflow;
        document.documentElement.style.overflow = previousRootOverflow;
        return;
      }
      const height = Math.min(viewport?.height ?? window.innerHeight, window.innerHeight - keyboardHeight);
      const keyboard = keyboardHeight > 100 || window.innerHeight - height > 100;
      setFrame({ height, keyboard });
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    };
    const show = (event: Event) => { keyboardHeight = (event as Event & { keyboardHeight?: number }).keyboardHeight ?? 0; update(); };
    const hide = () => { keyboardHeight = 0; update(); };
    update();
    media.addEventListener("change", update);
    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    window.addEventListener("keyboardWillShow", show);
    window.addEventListener("keyboardDidShow", show);
    window.addEventListener("keyboardDidHide", hide);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      media.removeEventListener("change", update);
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("keyboardWillShow", show);
      window.removeEventListener("keyboardDidShow", show);
      window.removeEventListener("keyboardDidHide", hide);
    };
  }, []);
  if (!frame) return children;
  return createPortal(<div className="group fixed inset-x-0 top-0 z-30 overflow-hidden bg-bg" data-keyboard={frame.keyboard} style={{ height: frame.height, paddingBottom: frame.keyboard ? 0 : "calc(90px + max(24px, env(safe-area-inset-bottom)))" }}>{children}</div>, document.body);
}
