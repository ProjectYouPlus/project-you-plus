# Project You+ OpenAI Agent Runtime

The production AI Operations Center uses the server-only `OPENAI_API_KEY` environment variable in Vercel. Never expose this key through a `NEXT_PUBLIC_*` variable or commit it to GitHub.

Agent runs are initiated from the authenticated Owner AI Operations screen and write run status, summaries, usage metadata, and findings to the existing Supabase agent tables.

Production code-writing, destructive database actions, and deployment actions remain approval-gated until their dedicated tool permissions are connected.
