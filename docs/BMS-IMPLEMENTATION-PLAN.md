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
3. **Task Manager:** create, assign, prioritize, comment, update status, due-date views and notifications.
4. **CRM:** lead/contact pipeline, ownership, follow-up reminders and activity history.
5. **Order workflow:** inspect existing order APIs and Google Sheets sync before adding staff order submission; only approved submissions may sync. Never change existing sync reconciliation semantics without approval.
6. **Reports and proposal tools:** add business reporting and proposal generation after core data workflows are stable.
7. **Verification:** typecheck/build, migration review on a disposable Neon branch, role tests and regression checks for all existing admin modules.

## Current state
- The feature branch is based on `fix/production-admin-routes`.
- Existing legacy authentication validates `cms_admins` and `admin_security_sessions` using the legacy database connection.
- Existing order and Sheets-sync code operates on `cms_fiverr_orders`; it is intentionally untouched.
- Migration `002_business_management.sql` is additive and has not been run against any database.
