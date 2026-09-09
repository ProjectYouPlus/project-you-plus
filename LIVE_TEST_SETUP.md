# Project You+ — Live Account Test Setup

This build is prepared for a real Supabase user account on Vercel.

## 1. Create Supabase project
- Create a project in Supabase.
- Open SQL Editor and run the entire `supabase/schema.sql` file once.
- In Project Connect/API details, copy:
  - Project URL
  - Publishable key (`sb_publishable_...`), or legacy anon key.

## 2. Vercel environment variables
Set these in Vercel Project Settings → Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferred) OR `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DEMO_MODE=false`
- `NEXT_PUBLIC_SITE_URL=https://YOUR-PROJECT.vercel.app`

`ANTHROPIC_API_KEY` is optional for the first auth/data test.

## 3. Supabase Auth URL configuration
In Supabase → Authentication → URL Configuration:
- Site URL: your production Vercel URL
- Redirect URLs:
  - `http://localhost:3000/**`
  - your exact Vercel production URL + `/**`
  - optionally a Vercel preview wildcard while developing

## 4. Email confirmation
For the fastest private test, you may temporarily disable email confirmation in
Supabase Authentication provider settings. Then signup establishes a session
immediately and goes straight to onboarding.

If email confirmation stays enabled, update the Confirm signup email template so
its link targets:

`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`

The `/auth/confirm` route in this build verifies the token and creates the cookie
session before onboarding.

## 5. What persists now
With demo mode false, real user-specific data persists in Supabase for:
- account/profile + onboarding Blueprint
- goals
- tasks
- calendar events
- habits/logs
- workouts + health metrics
- finance tables/manual account data
- AI conversations/insights
- scores + weekly reviews
- integrations metadata

All tables use Row Level Security tied to `auth.uid()`.

## 6. What is still a connection prototype
Real institution/provider connections still require provider work:
- Bank + investment sync: financial data provider such as Plaid
- Apple Health: native iOS/HealthKit phase
- Google Calendar: OAuth integration phase
- Wearables: provider-specific APIs/native HealthKit depending source

Do not store bank usernames or passwords in Supabase.
