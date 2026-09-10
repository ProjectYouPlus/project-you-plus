# Project You+ — Connected Life setup

This guide is intentionally ordered from free/no-cost setup to paid services.

## 0. Supabase server secret — free and required for secure integrations

Use the modern Supabase **Secret key** (`sb_secret_...`) when your project has one. Project You+ V10 reads `SUPABASE_SECRET_KEY` first and keeps `SUPABASE_SERVICE_ROLE_KEY` only as a legacy fallback.

### Supabase
1. Open the Project You+ Supabase project.
2. Open **Settings → API Keys**.
3. Under **Publishable and secret API keys**, copy or create the server-side Secret key.
4. Do not put this key in GitHub, client code, or any `NEXT_PUBLIC_` variable.

### Vercel
Add the value to Preview and Production as:

- `SUPABASE_SECRET_KEY`

Redeploy after saving it.

## 1. Google Calendar — free

Project You+ V10 uses Google Calendar read-only access first.

### Google Cloud
1. Create or select a Google Cloud project.
2. Enable the Google Calendar API.
3. Open Google Auth Platform and configure the OAuth consent screen.
4. Create an OAuth client with application type **Web application**.
5. Add this Authorized redirect URI exactly:

   `https://project-you-plus.vercel.app/api/integrations/google-calendar/callback`

6. Copy the client ID and client secret.

### Vercel
Add these environment variables to Preview and Production:

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `NEXT_PUBLIC_SITE_URL=https://project-you-plus.vercel.app`
- `SUPABASE_SECRET_KEY`

Redeploy after saving them.

### Test
1. Sign in to Project You+.
2. Open **You → Connections → Google Calendar**.
3. Choose **Connect**.
4. Approve the read-only Google Calendar permission.
5. After redirecting back, Dashboard should include imported Google events in its selected-day schedule.

## 2. Plaid Sandbox — free

Plaid Sandbox uses mock financial institutions/data and does not connect real bank accounts.

### Plaid
1. Create a Plaid developer account.
2. Open the Plaid Dashboard API Keys section.
3. Copy the `client_id` and **Sandbox** secret.

### Vercel
Add these to Preview and Production:

- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV=sandbox`
- `SUPABASE_SECRET_KEY`

Redeploy after saving them.

### Test
1. Sign in to Project You+.
2. Open **Finance → Connect account**.
3. Launch Plaid Link.
4. Pick a Sandbox institution.
5. Use Plaid's standard Sandbox credentials: `user_good` / `pass_good`.
6. Project You+ should sync mock accounts, transactions, and supported investment holdings into Finance.

## 3. Alerts, streaks, Circles/challenges — no external account needed

These use Supabase and the Project You+ app itself. V10 already contains:

- task/habit reminder scheduling
- daily streak tracking
- accountability profiles and friend requests
- challenges and leaderboards
- automatic challenge point recalculation from completed tasks, habit check-ins, and workouts

True background push notifications still need a delivery layer (Web Push/VAPID or native APNs later).

## 4. OpenAI — usage based, not part of the free setup

When ready, add `OPENAI_API_KEY`. Project You+ then prefers OpenAI for Coach, Nutrition AI, workout planning, Run My Day, and Weekly Review. Anthropic remains an optional backup; local rules remain the last fallback.

## 5. Apple Calendar — native iOS phase

Do not fake Apple Calendar in the web app. Use EventKit when Project You+ moves into its native iPhone shell. Apple Developer Program membership is a separate paid requirement.

## Security rules

Never commit secrets to GitHub. Keep the Supabase server Secret key, Plaid secret, Google client secret, and AI keys in Vercel server environment variables only.
