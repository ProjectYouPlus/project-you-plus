"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function CoachComposer({ children }: { children: ReactNode }) {
  const [mobile, setMobile] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [editing, setEditing] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const viewport = window.visualViewport;
    let nativeHeight = 0;
    const update = () => {
      setMobile(media.matches);
      const viewportInset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      setKeyboardInset(Math.max(nativeHeight, viewportInset));
    };
    const show = (event: Event) => {
      const keyboard = event as Event & { keyboardHeight?: number };
      nativeHeight = keyboard.keyboardHeight ?? 0;
      update();
    };
    const hide = () => { nativeHeight = 0; setEditing(false); update(); };
    update();
    media.addEventListener("change", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("keyboardWillShow", show);
    window.addEventListener("keyboardDidShow", show);
    window.addEventListener("keyboardDidHide", hide);
    return () => {
      media.removeEventListener("change", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("keyboardWillShow", show);
      window.removeEventListener("keyboardDidShow", show);
      window.removeEventListener("keyboardDidHide", hide);
    };
  }, []);

  const composer = <div ref={container}
    onFocusCapture={() => setEditing(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setEditing(false); }}
    className={mobile ? "fixed inset-x-2 z-50 mx-auto max-w-[520px] rounded-[22px] border border-white/10 bg-[#14121f] shadow-lg" : ""}
    style={mobile ? { bottom: keyboardInset > 100 ? keyboardInset : 100 } : undefined}>
    {mobile && editing && <div className="flex justify-end px-3"><button type="button" className="min-h-11 px-3 text-sm font-semibold text-accent-text" onPointerDown={event => event.preventDefault()} onClick={() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setEditing(false);
    }}>Done</button></div>}
    {children}
  </div>;
  return mobile ? <><div className="h-24 shrink-0" aria-hidden="true"/>{createPortal(composer, document.body)}</> : composer;
}
