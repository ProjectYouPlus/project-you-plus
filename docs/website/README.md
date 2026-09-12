# Public website

The public homepage shares the existing Next.js/Vercel project. Only `/`, `/api/beta-waitlist`, `/api/site-events`, `/robots.txt`, and `/sitemap.xml` bypass session middleware. Every product route retains its existing authentication and onboarding checks. `/welcome`, `/login`, OAuth callbacks and the application's site URL remain intact.

Canonical: https://projectyouplus.com. Vercel redirects www to the apex using HTTP 308. Namecheap BasicDNS supplies `A @ 216.198.79.1` and `CNAME www cff07cb51b3a9d83.vercel-dns-017.com.`. Existing mail settings are retained.

## Assets

- Product logo: unchanged approved `public/project-you-plus-logo.svg`. The favicon is the exact embedded artwork decoded to PNG.
- 1% mark: supplied directly by the owner on September 12, 2026, as `1%logo.png`. The original is preserved and the homepage uses a resized WebP with unchanged proportions/colors.
- Product captures: real `/dashboard`, `/today`, `/coach`, `/review` routes on commit `62f0c3d`, running locally with explicit demo mode and the pre-existing Michael persona in `lib/mock-data.ts`. No member data was used. Captures are prominently labeled illustrative demo data. Demo mode is OFF for the deployed application.
- Screens retain the current interface. No invented trajectory line or unsupported weekly health/finance visualization was added.
- Social image: original typography composition and the existing approved Project You+ artwork.

## Beta and analytics

Project: `ehyewrldhttmijizdwhs` (Project You+).

`public.beta_waitlist` stores name, normalized unique email, optional improvement goal, optional yes/maybe/no willingness to pay, first-visit source and UTM attribution, and waiting status. The $19.99 question is research only. No email service is called and no payment is collected.

`public.website_events` stores anonymous visit IDs and funnel events. `waitlist_submitted` and pricing responses are written in the same database transaction as the new signup. Duplicates do not increment conversion or overwrite an existing signup. Client events use persistent request IDs for retry deduplication. Session storage preserves first-touch attribution across refreshes; blocked storage falls back to in-memory attribution.

Raw IPs, full referrer URLs, query strings beyond the selected UTMs, and user agents are not retained. Anonymous/minute rate limits store keyed IP hashes and expire stale rows. Server endpoints bound request sizes, validate inputs, reject cross-origin submissions, and enforce rate limits. Tables have RLS and all client privileges revoked; the lack of public RLS policies is intentional, since only the server service role can access them. No signup data appears in browser bundles or public read APIs.

Use the Supabase dashboard to inspect submissions. Run `docs/website/conversion.sql` for the visitor-to-signup funnel by source/campaign; this includes zero-conversion traffic. A visit is a tab session, not a permanent cross-device person identity. Browser-blocked analytics cannot be measured.

## Verification

`npm run lint`, `npm run typecheck`, `npm run build`, `npx tsx --test tests/website.test.ts`.

`tests/e2e/public-website.spec.ts` covers navigation, mobile overflow, reduced motion, form accessibility and request failure recovery. Live validation also submits reserved `@example.invalid` test addresses, verifies database rows/atomic conversion/duplicates, then removes only those test rows and sessions. No automatic email is sent.
