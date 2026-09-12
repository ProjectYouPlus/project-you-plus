# Project You+ — MVP Shell

A complete, runnable Next.js + Supabase application shell. Every screen in
the build order (Today → Goals → Tasks → Habits → Calendar → 1% Score →
AI Coach → Weekly Review) is implemented and interactive. No paid
integrations, Stripe, or production Claude calls yet — those are later
phases, per the spec.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000. That's it — **demo mode ships on by default**,
so the app is fully browsable immediately with no Supabase project, using
one coherent demo persona ("Michael") across every screen. `.env.local` is
already included with `NEXT_PUBLIC_DEMO_MODE=true`.

## Going live with Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor (or `supabase db push`). It
   creates all 20 entities from the data architecture spec and enables
   row-level security on every one of them, scoped to `auth.uid()`.
3. Fill in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_DEMO_MODE=false
   ```
4. Restart `npm run dev`. Auth, middleware route protection, onboarding
   persistence, and the Goals/Tasks/Habits data layer all switch from demo
   data to live Supabase queries automatically — no component code changes.

## What's real vs. mock right now

| Area | Status |
|---|---|
| Auth (login/signup/forgot password) | Real Supabase Auth, demo-gated |
| Middleware route protection | Real, skipped only while demo mode is on |
| Onboarding → Blueprint | Real flow; blueprint generation is deterministic (no AI call yet, per spec Step 5) |
| Profile | Real Supabase read/write |
| Goals | Real Supabase CRUD |
| Tasks | Real Supabase CRUD, including Today's Priorities list |
| Habits | Real Supabase CRUD + consistency computed from `habit_logs` |
| Calendar | Mock (internal events only — Google/Apple/Outlook sync is a later phase) |
| Health, Fitness, Money | Mock (wearables/bank integrations are a later phase) |
| AI Coach | Real chat UI, mock replies (`getMockCoachReply` — swap for a Claude API call, signature already matches) |
| 1% Score, Progress, Weekly Review | Mock — scoring algorithm isn't built yet, this is UI + demo data |
| Integrations page | Honest status only — nothing is marked "Connected" that isn't actually wired up |

## Known gaps / fast follows

- **Habits aren't linked to goals in the schema yet** (`habits` has no
  `goal_id` column). The Goal detail page shows a "Keystone habit" for the
  three demo goals via a hardcoded map — add the column and a real join
  when you're ready to make that dynamic.
- **1% Score is not computed** — `daily_scores` exists in the schema but
  nothing writes to it yet. That's the next real logic to build once
  Health/Fitness/Money have real data sources to score against.
- **Social login** is stubbed in `components/auth/auth-form.tsx` with a
  comment showing where to add a provider button + OAuth server action.

## Verification note

This was built in a sandboxed environment with no package-registry access,
so `npm install` could not actually be run here to produce a live
`next build`. What was verified instead: every `@/` import resolves to a
real file, all TS/TSX files have balanced braces/parens, every nav link
has a matching route, every `supabase.from(...)` call targets a real table
in `schema.sql`, env var names match between code and `.env.example`, and
every button has a working handler. Run `npm install && npm run dev`
yourself as the authoritative check — if a type error surfaces that only a
live TypeScript compiler could catch, it'll be an isolated fix, not a
structural one.

## Project structure

```
app/
  (auth)/login, signup, forgot-password       — Supabase Auth pages
  onboarding/, onboarding/blueprint/          — multi-step flow + blueprint reveal
  (app)/                                      — authenticated shell
    today, goals, goals/new, goals/[id]
    tasks, habits, calendar, progress, coach, review
    health, fitness, money, integrations, profile, settings, more
components/
  layout/    — Sidebar (desktop), BottomNav (mobile), nav config, icons
  auth/, onboarding/, goals/, tasks/, habits/, coach/, profile/, theme/
  today/, ui/                                 — from the original foundation
lib/
  data/      — Supabase-or-demo data functions (profile, goals, tasks, habits)
  actions/   — Server Actions (auth, onboarding, goals, tasks, habits, profile)
  supabase/  — browser client, server client, middleware helper
  demo-mode.ts, mock-data.ts, blueprint.ts, types.ts, utils.ts
supabase/schema.sql                           — full schema + RLS
```

## Next in the build order

1. Wire up the real 1% Score calculation once Health/Fitness/Money have
   live data sources — this is the natural next milestone.
2. Add `goal_id` to `habits` for real goal↔habit linking.
3. Replace `getMockCoachReply` with a real Claude API call.
4. Integrations phase: Google Calendar, Apple Health, Plaid, wearables —
   in that order, per the original roadmap.
5. Stripe + paid tiers once the product has traction.

## UI V2 pass

This build includes a desktop polish pass that preserves the existing routes and data architecture while improving information hierarchy and use of space. The Today, Goals, Tasks, Habits, Progress, Health, Money, and Personal Blueprint screens now use responsive desktop layouts with stronger AI insight placement and larger key metrics. Demo mode remains enabled by default.

## Phase 7 — Project You+ Intelligence

This build includes a server-side intelligence layer:

- `lib/ai/context.ts` builds one grounded context object from Profile, Goals, Tasks, Habits, Health, Money, Schedule, and the deterministic 1% Score.
- `lib/score.ts` calculates the 1% Score from observable inputs. The LLM never invents or recalculates the score.
- `lib/insights.ts` creates deterministic proactive insights.
- `/api/coach` powers the AI Coach.
- `/api/run-my-day` creates an optimized day plan.
- `/api/weekly-review` creates the weekly interpretation.

### AI configuration

The app works without an AI API key using local deterministic intelligence. To enable live Claude responses, add these **server-only** environment variables locally and in Vercel:

```env
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-sonnet-5
```

Never prefix the API key with `NEXT_PUBLIC_`.

If Claude is unavailable or returns invalid structured output, Project You+ automatically falls back to the local intelligence layer instead of breaking the user experience.

## Project You+ V5 — Figma reconciliation pass

This source now matches the refined Project You+ mobile product architecture in the Figma product-design file.

### Root navigation

Mobile navigation is now intentionally limited to four permanent destinations:

- **Today** — what matters now: score, focus, health/money snapshots, habits, AI Coach prompt, schedule.
- **Plan** — Goals, Tasks, Calendar, protected time, capacity, and AI planning guidance.
- **Coach** — cross-app intelligence for decisions, planning, and reflection.
- **You** — Health, Fitness, Money, Habits, Progress, Weekly Review, Integrations, Profile, and Settings.

The old `More` route remains only as a compatibility redirect to `/you`.

### New premium interaction flows

- `/health/scan-meal` — camera/file input → meal preview → AI-style detected foods → editable portions → recalculated macros → save-to-today confirmation. The current analyzer is intentionally a **demo estimator**; swap it for a production vision/model endpoint without changing the review UI.
- `/tasks/new` — smart task creation with linked goal, duration, energy, priority, calendar-aware placement, and demo-mode persistence via a short-lived cookie.
- `/money/connect` — permission-selection and secure-provider handoff prototype for bank and investment connections. It does **not** collect banking credentials itself.

### Onboarding V5

Onboarding is now a five-stage personalization flow rather than ten isolated survey screens:

1. Priorities, goals, and one-year success.
2. Real schedule, daily capacity, energy pattern, blockers, and protected commitments.
3. Health, fitness, habits, and photo nutrition preference.
4. Financial context, money goals, and coaching style.
5. Optional connection preferences and personalized-plan summary.

The same existing `completeOnboarding` server action and Blueprint persistence are reused, with additional optional Blueprint context fields.

### Validation performed in this environment

The package registry is not reachable from this sandbox, so a real `npm install && next build` could not be executed here. The source was still audited with:

- TypeScript parser validation across all TS/TSX files.
- Local `@/` import-resolution audit.
- Static internal route/href audit.
- JSON validation for design tokens and package metadata.

Run `npm install && npm run build` locally or in CI as the authoritative framework/type/build check.
