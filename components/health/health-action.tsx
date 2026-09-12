"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { emitFeedback } from "@/lib/celebrations/client";
import type { FeedbackKind } from "@/lib/celebrations/types";
export function HealthAction({
  action,
  children,
  className = "py-button-secondary",
  disabled = false,
  feedback,
}: {
  action: () => Promise<{ error: string | null } | void>;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  feedback?: FeedbackKind;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div>
      <button
        type="button"
        disabled={busy || disabled}
        className={`${className} min-h-[44px] disabled:opacity-50`}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const result = await action();
            if (result?.error) setError(result.error);
            else { if (feedback) emitFeedback(feedback); router.refresh(); }
          } catch {
            setError("Could not save. Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : children}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
