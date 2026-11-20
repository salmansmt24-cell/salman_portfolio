# JS Salman Portfolio — Vercel migration starter

This is **Phase 1** of the migration. It preserves the supplied HTML template, CSS, images, uploads and CMS defaults, and adds a Next.js catch-all route that reads `cms_content` and `cms_items` from Neon. The supplied PHP admin backend has **not yet** been converted; do not switch the live domain to this project yet.

## 1. Run locally

```bash
npm install
cp .env.example .env.local
# Add your Neon DATABASE_URL to .env.local
npm run dev
```

Open http://localhost:3000 and http://localhost:3000/api/health.

## 2. Neon schema

In Neon SQL Editor, run `migration/001_schema.sql`. It creates the 20 PostgreSQL tables from the supplied MariaDB schema. This is schema-only; it does not import the SQL dump's records.

## 3. Important source audit findings

- The source's `intelligence_v4.php` and related PHP code refer to `cms_fv_commissions` and `cms_fv_expenses`, while the provided database has `cms_fv_mp_commission` and `cms_fv_mp_expenses`. These are source/schema mismatches and need a deliberate compatibility fix during the admin conversion.
- The SQL export contains 20 tables. The starter schema retains their names and columns; review generated DDL before production.
- Do not commit credentials, `.env.local`, PHP config files, service-account JSON, or private tokens. Rotate any credential exposed in the old hosting files.

## 4. Deployment

Push this folder to your existing GitHub repository, import that repository in Vercel, and add `DATABASE_URL` in Vercel Project → Settings → Environment Variables. Deploy only to a preview URL until admin/API conversion, data import, file storage migration, and regression testing are complete.

## 5. Remaining phases

1. Convert PHP authentication/session handling to secure Next.js authentication.
2. Rebuild the content editor, collections CRUD, messages, Fiverr orders/profiles, templates, analytics, insights, monthly tools and sync modules.
3. Import all SQL records and verify counts and key totals.
4. Move uploads to Vercel Blob and update stored paths.
5. Rebuild Google Sheets integration with server-only credentials and signed webhooks.
6. Test all write paths, exports, permissions and production deployment.
