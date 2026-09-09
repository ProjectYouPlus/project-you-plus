"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
      <div className="text-[13px] font-semibold text-danger">Something went wrong</div>
      <h1 className="m-0 text-[22px] font-bold tracking-tight text-text-1">We hit a snag</h1>
      <p className="m-0 max-w-xs text-[14.5px] text-text-2">
        Try again — if it keeps happening, the console has the underlying error.
      </p>
      <button
        onClick={reset}
        className="mt-3 rounded-sm bg-text-1 px-5 py-2.5 text-[14px] font-semibold text-bg"
      >
        Try again
      </button>
    </div>
  );
}
