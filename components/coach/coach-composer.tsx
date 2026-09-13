"use client";

import { useEffect, useState, type ReactNode } from "react";

export function CoachComposer({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const hide = () => setEditing(false);
    window.addEventListener("keyboardDidHide", hide);
    return () => window.removeEventListener("keyboardDidHide", hide);
  }, []);
  return <div className="shrink-0 border-t border-white/10 bg-[#14121f]"
    onFocusCapture={() => setEditing(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setEditing(false); }}>
    {editing && <div className="flex justify-end px-3 md:hidden"><button type="button" className="min-h-11 px-3 text-sm font-semibold text-accent-text" onPointerDown={event => event.preventDefault()} onClick={() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setEditing(false);
    }}>Done</button></div>}
    {children}
  </div>;
}
