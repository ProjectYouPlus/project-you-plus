"use client";
import { attribution, type Attribution } from "./attribution";
type Visit = Attribution & { session_id: string };
let memory: Visit | undefined;
const pending = new Set<string>();
export function visit(): Visit {
  if (memory) return memory;
  try { const saved = sessionStorage.getItem("youplus-visit-v1"); if (saved) { memory = JSON.parse(saved) as Visit; return memory; } } catch { /* Storage may be blocked in an in-app browser. */ }
  const params = new URLSearchParams(location.search);
  memory = { ...attribution({ utm_source: params.get("utm_source"), utm_medium: params.get("utm_medium"), utm_campaign: params.get("utm_campaign"), referral_source: document.referrer }), session_id: crypto.randomUUID() };
  try { sessionStorage.setItem("youplus-visit-v1", JSON.stringify(memory)); } catch { /* In-memory attribution still works. */ }
  return memory;
}
export function track(event: string) {
  if (["localhost", "127.0.0.1"].includes(location.hostname)) return;
  const data = visit();
  // These events fire once per visit, including across a reload.
  const eventId = `${data.session_id}:${event}`;
  if (pending.has(eventId)) return;
  try { if (sessionStorage.getItem(eventId)) return; } catch { /* Optional storage. */ }
  let requestId = crypto.randomUUID();
  try {
    const savedId = sessionStorage.getItem(`${eventId}:request`);
    if (savedId) requestId = savedId as typeof requestId;
    else sessionStorage.setItem(`${eventId}:request`, requestId);
  } catch { /* The current in-memory visit still works without storage. */ }
  pending.add(eventId);
  void fetch("/api/site-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, referral_source: data.referral_source ? `https://${data.referral_source}` : null, event, event_id: requestId }), keepalive: true }).then(response => { if (response.ok) { try { sessionStorage.setItem(eventId, "1"); } catch { /* Optional storage. */ } } }).catch(() => { /* Analytics must never block the beta form. */ }).finally(() => pending.delete(eventId));
}
