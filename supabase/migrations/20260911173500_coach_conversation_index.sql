create index if not exists ai_conversations_user_created_idx
  on public.ai_conversations(user_id,created_at desc);
