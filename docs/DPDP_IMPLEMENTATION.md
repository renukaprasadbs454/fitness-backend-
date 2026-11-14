# DPDP implementation status

This document records the repository implementation as of 2026-11-13. It is an engineering status report, not a legal opinion or a declaration of compliance.

## Repository architecture and scope

FitNerve uses Express, Prisma, PostgreSQL, JWT/password authentication, and Firebase Admin for push delivery. Firebase is not the authentication provider. This work adds privacy operations using the existing stack and an isolated PostgreSQL `privacy` schema. It does not change the deployed VPS or apply the migration.

## Implemented in this branch

- Versioned privacy notice and affirmative registration acknowledgement with version, timestamp, IP address, and user agent.
- Purpose catalogue and consent history/withdrawal endpoints. Withdrawing the optional `notifications` purpose disables all push notification categories. Device-token registration now requires current affirmative notification consent.
- Authenticated user privacy dashboard, own-data JSON/CSV export, access/correction/deletion request intake, grievance intake, and nominee CRUD (nominees are explicitly unverified).
- Admin privacy overview, paginated/searchable requests/grievances/audit, provider register, reviewed retention settings, dry-run report, and breach incident records.
- Audit records for privacy actions. User export is filtered to prevent coach accounts from receiving other clients' records.
- Automated service tests and versioned migration.

## Explicitly incomplete / requires owner or legal action

- This branch does not execute account erasure. Deletion requests are tracked, but no automated/manual erasure workflow, identity verification, exceptions assessment, or downstream provider confirmation is implemented.
- Retention only stores reviewed policy settings and produces a dry run with no eligibility queries; no cleanup worker runs.
- Incident records do not notify the Data Protection Board or affected people. The UI accurately states this; no statutory deadline scheduler or delivery evidence exists.
- Processor rows are seeded as `REVIEW_REQUIRED`; provider regions, contracts, transfer safeguards, subprocessors, and deletion/backup behavior need verification.
- The notice is a short registration summary linked to the existing policy URL. The full notice and public policy need legal review for required contents, language/accessibility, purposes, data categories, rights/grievance mechanism, and actual contact details.
- No date-of-birth/age assurance, parental-consent flow, or child-account controls were added. The product owner/legal adviser must decide eligibility and requirements before launch.
- Nominee identity/authority is not verified and there is no nominee access process.
- Consent mappings and essential/optional classifications are provisional product/legal decisions; confirm them against actual purposes and lawful basis.
- Automated DPIA/significant-data-fiduciary obligations, breach runbooks, processor due diligence, backup lifecycle, and operational access reviews remain outstanding.

## Local verification

Run `npm run test`, `npm run lint`, `npx prisma validate`, and `npx prisma generate` from `BACKEND`; run the frontend web export/type checks from `FRONTEND`. See `DPDP_TEST_REPORT.md` for exact results. Do not infer production readiness from local checks.

## Deployment boundary

Migration `20261113120000_dpdp_privacy_foundation` is additive and has not been applied here. Review and back up the target database, configure the current notice/policy URL and legal text, then deploy via the normal release process. Never use `prisma migrate reset` against production.
