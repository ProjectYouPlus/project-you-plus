import "server-only";

import { createClient } from "@/lib/supabase/server";

export type StoredCoachMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export async function getRecentCoachMessages(limit = 12): Promise<StoredCoachMessage[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id,role,content,created_at")
    .eq("user_id", user.id)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(Math.min(30, Math.max(1, limit)));
  if (error) throw new Error(error.message);
  return (data ?? []).reverse().flatMap((row) => row.role === "user" || row.role === "assistant" ? [{
    id: String(row.id),
    role: row.role,
    content: String(row.content).slice(0, 4000),
    createdAt: String(row.created_at),
  } as StoredCoachMessage] : []);
}

export async function saveCoachExchange(userId: string, message: string, reply: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) throw new Error("Not signed in.");
  const rows = [
    { user_id: user.id, role: "user", content: message.slice(0, 4000) },
    { user_id: user.id, role: "assistant", content: reply.slice(0, 8000) },
  ];
  const { error } = await supabase.from("ai_conversations").insert(rows);
  if (error) throw new Error(error.message);
}
