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

`public.beta_waitlist` stores name, normalized unique email, optional improvement goal, optional yes/maybe/no willingness to pay, first-visit source and UTM attribution, and waiting status. The public form no longer asks the $19.99 question. Historical optional pricing responses and backend support remain intact. No email service is called and no payment is collected.

`public.website_events` stores anonymous visit IDs and funnel events. `waitlist_submitted` and pricing responses are written in the same database transaction as the new signup. Duplicates do not increment conversion or overwrite an existing signup. Client events use persistent request IDs for retry deduplication. Session storage preserves first-touch attribution across refreshes; blocked storage falls back to in-memory attribution.

Raw IPs, full referrer URLs, query strings beyond the selected UTMs, and user agents are not retained. Anonymous/minute rate limits store keyed IP hashes and expire stale rows. Server endpoints bound request sizes, validate inputs, reject cross-origin submissions, and enforce rate limits. Tables have RLS and all client privileges revoked; the lack of public RLS policies is intentional, since only the server service role can access them. No signup data appears in browser bundles or public read APIs.

Use the Supabase dashboard to inspect submissions. Run `docs/website/conversion.sql` for the visitor-to-signup funnel by source/campaign; this includes zero-conversion traffic. A visit is a tab session, not a permanent cross-device person identity. Browser-blocked analytics cannot be measured.

## Verification

`npm run lint`, `npm run typecheck`, `npm run build`, `npx tsx --test tests/website.test.ts`.

`tests/e2e/public-website.spec.ts` covers navigation, mobile overflow, reduced motion, form accessibility and request failure recovery. Live validation also submits reserved `@example.invalid` test addresses, verifies database rows/atomic conversion/duplicates, then removes only those test rows and sessions. No automatic email is sent.

## Original website restore point

The owner-approved original is preserved in GitHub at `archive/public-website-original-2026-09-12`, commit `f37211f66312abb0ac393add351d49e1d9d0e429`. Its production deployment is `dpl_J6qx5TEVL12vthYGd3URaUpVAHcA` (`project-you-plus-p31nkzmrz-miguelbinet-9644.vercel.app`).

To remove only the experimental background, set `WEBSITE_BACKGROUND_MOTION` to false in `lib/website/presentation.ts` and redeploy. To restore the entire original, restore the website files from the named branch and deploy, preserving any subsequent application work and all waitlist submissions. The existing original Vercel deployment also provides an immediate full-deployment rollback if no later application changes must be retained.

Trajectory v2 was recaptured from the same real demo interface at 1290 × 2796 (3× device density), replacing the low-resolution 430 × 932 capture. Product image delivery uses quality 92. Decorative arrow/check glyphs have been removed from marketing controls; original product captures retain their actual interface. The background now uses two scroll-linked light layers with a short eased settle, and stops requesting frames when settled. Reduced motion disables both layers.

## Owner overview and search visibility

`/owner` now contains Website & private beta for active owner/admin roles. It reports 7/30/90-day tracked sessions, unique-email signups, matched-session conversion, CTA activity, daily activity, source/campaign breakdowns and the latest ten waitlist entries. Counts aggregate in Postgres, avoiding the API row limit. `/api/owner/website` rechecks authentication and the current database role on every request, disables caching, and refreshes the panel every minute while visible. Analyst/support/ordinary users have no access to this data. Database RPC execution remains service-role-only.

Reporting uses UTC dates. A visit is a tab session, not a unique person. Conversion is the share of observed visit sessions with a signup event, so it cannot overstate conversion when signups lack visitor tracking. Known `website_qa` campaigns and reserved `@example.invalid` emails are excluded. Early untagged development visits are retained and disclosed; localhost stops emitting website analytics going forward.

Search setup includes Organization, WebSite and WebPage structured data, the canonical brand identity, share metadata, large image previews, an updated sitemap, crawler access to public assets, and noindex defaults for application/authentication pages. Only the public homepage opts into indexing. Google Search Console domain ownership was verified through the site's Namecheap TXT record on 2026-09-12. Keep that verification record in DNS. Use the Search performance link in the owner panel to see Google's own indexing/query/click data; those metrics are not invented or mixed into onsite visit counts.
