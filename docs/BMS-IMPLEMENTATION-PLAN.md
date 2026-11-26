# Business Management System — implementation plan

## Safety rules
- Work only on `feature/business-management-system` until the owner explicitly approves a production release.
- Keep every existing `cms_*` table, route, login flow, dashboard page, and Google Sheets sync behavior intact.
- Add new BMS functionality through the `bms_*` namespace and additive migrations.
- Do not apply migrations to the live Neon database during development.
- Enforce authorization in server routes; hiding navigation items is not authorization.
- Do not permit public self-registration. Accounts are invited/created and approved by authorized administrators.
- Store only password hashes and hashed, expiring invitation/session tokens.

## Roles
- **Super Admin:** all BMS modules, roles, account approval, settings.
- **Admin:** operational management and team administration, excluding protected Super Admin controls.
- **Team Leader:** assigned team visibility, task creation/assignment and progress review.
- **Sales Executive:** assigned leads, follow-ups, and permitted order-entry workflows.
- **Viewer:** read-only access explicitly granted by policy.

## Delivery sequence
1. **Foundation (current):** additive tables for team accounts/sessions, tasks/comments, CRM leads, notifications and activity history.
2. **Team access:** invite/approve/suspend members; separate BMS login/session; server-side role checks. Preserve existing legacy Admin login.
3. **Task Manager (Preview feature):** task creation, assignment, priority, due date, status, comments and notifications.
4. **CRM (Preview feature):** lead creation, assigned ownership, pipeline stage, estimated value, notes and follow-up date.
5. **Order workflow (Preview feature):** team order submissions are held separately, then Admin reviews/approves/rejects. Approved entries are marked pending Sheets integration; they are not automatically appended to Google Sheets until an outbound connector/webhook is configured and verified.
6. **Reports and proposal tools:** still planned; not part of the current build batch.
7. **Verification:** deployment build, migration review on Preview, role tests and regression checks for existing admin modules.

## Current state
- The feature branch is based on `fix/production-admin-routes`.
- Existing legacy authentication validates `cms_admins` and `admin_security_sessions` using the legacy database connection.
- Existing order and Sheets-sync code operates on `cms_fiverr_orders`; it remains untouched.
- Migration `002_business_management.sql` is additive. The original BMS tables and the new `bms_order_submissions` table have been applied to the Preview branch database `salman_portfolio` only. Production was not modified.

## Team authentication stage (implemented on feature branch)

- Team members are invited by an existing legacy admin; public self-registration is not exposed.
- Invitation tokens are generated with Node crypto, stored only as SHA-256 hashes, expire after 7 days, and are single-use.
- The invitation URL is shown once in Team Management for the admin to share privately. Email delivery is not configured yet.
- Members set a password (minimum 12 characters); password hashes use the existing bcryptjs dependency.
- Invitation acceptance changes the account to pending; a legacy admin must approve it before login.
- Team login uses a separate bms_team_session HttpOnly cookie and rows in bms_user_sessions; the legacy admin cookie and login routes are unchanged.
- Suspended/non-active members cannot establish or continue a BMS session.
- Routes: /team/login, /team/accept?token=..., and /team.
- This code is not live until migration 002 is applied to a Preview database and the feature branch is deployed to a Preview environment.


## Current Preview modules

- Team login / invitation acceptance / admin approval / suspension.
- Team dashboard links: Tasks, CRM Leads, Notifications, Order Entry.
- Admin navigation includes Team Management and BMS Order Review.
- Tasks support assignment, status, comments and activity/notification records.
- CRM supports lead creation, stage changes, notes and follow-up date.
- Team order entry creates a separate pending-review submission. Admin approval changes it to approved and marks Sheets status pending. It does **not** write to Google Sheets yet; a secure outbound Sheets connector/webhook and test sheet are still required. Existing inbound Sheets sync behavior is preserved.
- Public portfolio navigation has a Team Login link.

## Remaining before a complete business rollout

- Configure and test outbound Google Sheets append integration; approved orders must be appended once and never expose pending/rejected rows.
- Complete rate limiting and further auth hardening for team login.
- Add broader reports/proposal workflow and validate role-scoped team visibility.
- Run build/typecheck and full role-based smoke tests on the final Preview deployment. Production release requires explicit owner approval.
