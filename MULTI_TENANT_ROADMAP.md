# ToolNest multi-tenant portfolio rollout

## Product shape
ToolNest is a multi-user portfolio builder. Each registrant receives a private dashboard and can publish one public portfolio at `https://<username>.toolnest.com`. The existing legacy CMS remains the platform-owner admin area during the migration.

## Branch and safety
- Development branch: `feat/toolnest-multi-tenant`
- Base: `migration/admin-auth-audit`
- Production is not changed; no production alias, deployment target, environment variable, domain, or database data is modified.
- Migration `migration/002_multi_tenant_portfolio.sql` is additive and creates only new `app_*` and `portfolio_*` tables. It does not update, rename, or delete any `cms_*` table.
- Do not run the SQL against Neon until it has been reviewed and the Preview environment is confirmed to point to the intended database.

## Data model
- `app_users`: account identity, unique case-insensitive email/username, role and account status.
- `app_user_profiles`: editable personal details.
- `portfolio_sites`: one site per account, unique username slug, template/theme/SEO and publication state.
- `portfolio_projects`, `portfolio_skills`, `portfolio_experiences`, `portfolio_education`, `portfolio_social_links`: owner-scoped portfolio content.
- `app_user_sessions`: hashed session tokens; raw tokens must only be held in secure HttpOnly cookies.
- `app_email_tokens`: hashed, expiring, single-use email verification and password reset tokens.
- `portfolio_audit_events`: account/admin activity audit trail.

## Security requirements before enabling registration
1. Hash passwords with Argon2id (preferred) or bcrypt; never store plaintext.
2. Verify email before setting account status to `active`; pending accounts cannot publish.
3. Use random opaque session tokens; store only SHA-256 hashes in the database. Cookies: HttpOnly, Secure in production, SameSite=Lax, Path=/.
4. Every dashboard/API query must derive the owner ID from the verified session, never from a client-supplied user_id.
5. Every user-owned SELECT/INSERT/UPDATE/DELETE must scope by `user_id`; admin access must be checked server-side.
6. Validate usernames, reserve system routes/names (admin, api, www, dashboard, login, register, support, mail, ftp, assets, static), and prevent username changes after publication unless redirect handling is designed.
7. Add registration/login rate limits, CSRF/origin protection, generic auth errors, password reset, email verification and abuse reporting before public launch.
8. Public portfolio resolution must require `is_published = TRUE`; never expose dashboard/private profile fields.
9. Add upload limits, file-type validation, malware scanning strategy and storage access controls before allowing user uploads.

## Domain rollout
- First validate routing on the existing Vercel preview hostname with a path-based preview route such as `/p/<slug>`.
- For real subdomains, add `*.toolnest.com` to the Vercel project and configure the DNS wildcard record at the domain's DNS provider. Confirm apex domain ownership and DNS control first.
- Resolve hostnames server-side, normalize the hostname, look up the matching published slug, and render only public fields.
- Do not assume `toolnest.com` is already owned or connected. Wildcard DNS/domain setup is a separate deployment step and may require user-side DNS access.

## Phased implementation
1. Additive schema and architecture review (this branch).
2. Build signup, email verification, login/logout, session validation and password reset.
3. Build user dashboard and owner-scoped profile/project CRUD.
4. Build portfolio editor, templates, preview and publish/unpublish.
5. Add public slug route on preview; test cross-user isolation.
6. Configure wildcard domain and subdomain routing after domain access is confirmed.
7. Add admin user management, abuse controls, analytics, backups and launch hardening.

## Current status
Phase 1 files are prepared only. SQL has not been run, no new users have been created, and registration is not enabled.
