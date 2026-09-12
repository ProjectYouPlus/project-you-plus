# Project You+ Onboarding v2 — Production Verification

Date: 2026-09-12

Production onboarding v2 was merged through PR #9 after verification of the deployable code tree.

## Verified gates

- Lint: passed
- Unit/integration tests: 66/66 passed
- TypeScript: passed
- Next.js production build: passed
- Playwright Chromium/WebKit regression: passed
- Vercel preview: READY with no error/fatal runtime logs in the verification window
- Unauthenticated onboarding route: protected and resolves to authentication
- Connected Supabase activation: canonical records committed successfully
- Activation retry/double-submit: idempotent; canonical record counts remained unchanged
- Cross-user RLS check: unrelated authenticated identity returned zero onboarding sessions
- Onboarding completion: meaningful behavior event recorded
- AI Operations: onboarding generation run recorded
- Security boundary: `activate_onboarding_system(uuid)` remains security-invoker; the narrow private completion-event helper is security-definer and rechecks `auth.uid()` and completed-session ownership

## Connected browser E2E

The live browser onboarding test is intentionally credential-gated. It runs when `ONBOARDING_E2E_EMAIL` and `ONBOARDING_E2E_PASSWORD` are configured as GitHub Actions secrets for a confirmed disposable test account. It is skipped when those secrets are absent. No production auth bypass or test-only backdoor is present.
