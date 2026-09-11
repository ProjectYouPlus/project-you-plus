"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

declare global {
  interface Window {
    Plaid?: {
      create: (config: { token: string; onSuccess: (publicToken: string) => void; onExit?: (error: unknown) => void }) => { open: () => void; destroy: () => void };
    };
  }
}

export function PlaidLinkButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "starting" | "syncing">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function connect() {
    setMessage(null);
    setStatus("starting");
    try {
      await loadPlaid();
      const tokenResponse = await fetch("/api/integrations/plaid/link-token", { method: "POST" });
      const tokenData = await tokenResponse.json() as { linkToken?: string; error?: string };
      if (!tokenResponse.ok || !tokenData.linkToken) throw new Error(tokenData.error || "Could not start Plaid Link.");
      if (!window.Plaid) throw new Error("Plaid Link did not load.");

      let handler: { open: () => void; destroy: () => void } | null = null;
      handler = window.Plaid.create({
        token: tokenData.linkToken,
        onSuccess: (publicToken) => {
          setStatus("syncing");
          void (async () => {
            try {
              const response = await fetch("/api/integrations/plaid/exchange", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ publicToken }) });
              const data = await response.json() as { error?: string };
              if (!response.ok) throw new Error(data.error || "Could not sync the connected account.");
              setMessage("Connected. Your accounts are syncing into Project You+.");
              handler?.destroy();
              router.push("/money?connected=plaid");
              router.refresh();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Could not finish the bank connection.");
              setStatus("idle");
              handler?.destroy();
            }
          })();
        },
        onExit: () => { setStatus("idle"); handler?.destroy(); },
      });
      handler.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the secure bank connection.");
      setStatus("idle");
    }
  }

  return <div><button type="button" onClick={connect} disabled={status !== "idle"} className="py-liquid-button w-full disabled:opacity-50">{status === "starting" ? "Opening secure connection…" : status === "syncing" ? "Syncing accounts…" : "Connect bank or investments"}</button>{message && <p className={`m-0 mt-2 text-[11px] leading-relaxed ${message.startsWith("Connected") ? "text-positive" : "text-danger"}`}>{message}</p>}</div>;
}

let plaidScriptPromise: Promise<void> | null = null;
function loadPlaid() {
  if (window.Plaid) return Promise.resolve();
  if (plaidScriptPromise) return plaidScriptPromise;
  plaidScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Plaid Link."));
    document.head.appendChild(script);
  });
  return plaidScriptPromise;
}
