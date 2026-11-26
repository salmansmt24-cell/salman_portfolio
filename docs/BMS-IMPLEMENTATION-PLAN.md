# Business Management System — implementation plan

## Core product rule
BMS is a self-contained website application. All team accounts, tasks, CRM leads, order records, notifications, password-reset tokens, activity and reports are stored in the website's Neon PostgreSQL database. BMS does not use Google Sheets or an external spreadsheet for any workflow. Existing legacy website features and their separate integrations are preserved unless explicitly changed.

## Safety rules
- Work only on `feature/business-management-system` until the owner explicitly approves a production release.
- Keep legacy `cms_*` tables, routes, login flow and existing dashboard pages intact.
- Add BMS functionality through the `bms_*` namespace and additive migrations.
- Never apply development migrations to the production database.
- Enforce authorization in server routes, not only in the UI.
- No public account self-registration. Accounts are invited/created and approved by administrators.
- Store only password hashes and hashed, expiring one-time tokens.

## Roles
- **Super Admin:** full BMS access, role governance, approvals and settings.
- **Admin:** operational management and team administration, excluding protected Super Admin controls.
- **Team Leader:** team visibility, task creation/assignment and progress review.
- **Sales Executive:** assigned leads, follow-ups and permitted order-entry workflows.
- **Viewer:** read-only access explicitly granted by policy.

## Implemented Preview modules
- Team invitations, password setup, administrator approval, role assignment, suspension and reactivation.
- Separate team login/session from the legacy admin login.
- Task assignment, priority, due date, status, comments and notifications.
- CRM lead records, stages, estimated values, notes and follow-up dates.
- Native order submission and administrator approval/rejection. Order records remain in the BMS database.
- Proposal management with client, value, validity date and lifecycle status.
- Expense submission, administrator approval/rejection and reimbursement tracking.
- Admin expense review queue, activity log and notifications.
- Team forgot-password request and one-time reset link flow via email.
- Admin-issued one-time password reset links from Team Management.
- Password reset revokes existing sessions; tokens expire after 30 minutes and are single-use.
- Activity log records important team and order events.

## Password recovery configuration
Team email-based recovery requires Vercel Preview environment variables:
- `RESEND_API_KEY`: Resend API key.
- `BMS_FROM_EMAIL`: verified sender address permitted by the Resend account.

The forgot-password endpoint returns a generic response for unknown emails. It rate-limits requests by source IP. If email configuration is missing, users are instructed to contact the administrator; Admin can generate a one-time reset link from Team Management and share it privately. Reset links expire after 30 minutes.

## Database migrations
- `002_business_management.sql`: core BMS tables and native order submissions.
- `003_bms_native_orders_password_reset.sql`: password reset token table and removal of legacy spreadsheet-only columns from the new BMS order table.
- `004_bms_proposals_expenses.sql`: native proposal and expense tables.
- `005_bms_login_rate_limits.sql`: hashed-key throttling for repeated failed team login attempts.
- Apply migration 003 to the Preview `salman_portfolio` database only during this development phase. Production remains untouched.

## Reporting

- Team Reports & Analytics: personal or team-scoped task, lead pipeline, approved-order, monthly activity and workload summaries.
- Admin BMS Reports: team-wide business metrics and member workload from native BMS records.

## Preview verification

- Next.js production build completed successfully on the Preview deployment after adding proposal and expense management.
- Preview Neon database confirms the password-reset, native order, proposal and expense tables.
- No Preview runtime error logs were reported for the verified deployment.

## Remaining rollout work
- Add secure receipt upload/storage and optional proposal PDF generation.
- Add currency-aware financial summaries; current report totals are raw recorded amounts and should not be interpreted as a single-currency consolidated balance.
- Configure Resend sender/API key in Vercel Preview and test email delivery.
- Verify BMS login throttling on Preview using controlled test attempts; avoid locking out a real team account.
- Complete role-based smoke tests for every team module and password recovery.
- Expand proposal workflow and validate team-scoped visibility.
- Run the final Preview build and regression checks. Production release requires explicit owner approval.
