# ToolNest multi-tenant portfolio rollout

## Product
ToolNest is a multi-user portfolio builder. Each registrant receives a private dashboard and can publish one public portfolio at `https://<username>.toolnest.com`.

## Safety
- Development branch: `feat/toolnest-multi-tenant`; Production is not changed.
- Additive SQL migration: `migration/002_multi_tenant_portfolio.sql`. It creates new app_/portfolio_ tables only and does not alter legacy cms_* tables.
- Do not run migration until the Preview database target is confirmed.
- No public registration should be announced until migration, email verification, rate limiting and account administration are operational.

## Implemented in this phase
- Registration API: validates email/username/password, hashes passwords with bcrypt, creates a pending account, private profile and draft portfolio.
- Login API: permits active accounts only; pending/suspended accounts cannot sign in.
- Sessions: random opaque cookie, HttpOnly/Secure/SameSite=Lax; only SHA-256 token hash stored in DB.
- User dashboard: requires an active authenticated session and scopes all data queries to the session user ID.
- Registration requires admin approval for now. Email delivery and self-service email verification are not configured yet.

## Next phases
1. Apply additive migration to an explicitly confirmed Preview database.
2. Build admin user approval/suspension controls and email verification.
3. Build profile/project/skills/experience/education editor with strict owner scoping.
4. Build templates, preview, publish/unpublish and public /p/[slug] route.
5. Test cross-user isolation, auth rate limits, CSRF, password reset and abuse controls.
6. Add wildcard domain to Vercel and DNS only after confirming ownership and DNS provider access.
