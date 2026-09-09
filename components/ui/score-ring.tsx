"use client";

import { useEffect, useRef, useState } from "react";

interface ScoreRingProps {
  score: number; // 0-100
  size?: number;
}

const CIRCUMFERENCE = 283; // 2 * PI * r, r=45

export function ScoreRing({ score, size = 104 }: ScoreRingProps) {
  const [displayed, setDisplayed] = useState(0);
  const raf = useRef<number>();

  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * score));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) {
        cancelAnimationFrame(raf.current);
      }
    };
  }, [score]);

  const offset = CIRCUMFERENCE - (CIRCUMFERENCE * displayed) / 100;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 104 104" className="-rotate-90">
        <circle cx="52" cy="52" r="45" fill="none" stroke="var(--border)" strokeWidth="7" />
        <circle
          cx="52"
          cy="52"
          r="45"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.1s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[28px] font-extrabold tracking-tight text-text-1">
        {displayed}
      </div>
    </div>
  );
}
