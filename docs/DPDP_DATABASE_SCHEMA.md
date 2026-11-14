# Privacy schema

Migration: `prisma/migrations/20261113120000_dpdp_privacy_foundation/migration.sql`. It creates a dedicated PostgreSQL `privacy` schema and adds relations from existing `public.users`. Existing application tables remain in `public`; IDs remain text UUIDs to match the existing schema.

Tables: `privacy_notices`, `privacy_notice_acknowledgements`, `privacy_purposes`, `privacy_consent_records`, `privacy_consent_withdrawals`, `privacy_requests`, `privacy_grievances`, `privacy_nominees`, `privacy_processors`, `privacy_retention_policies`, `privacy_retention_runs`, `privacy_audit_logs`, and `privacy_breach_incidents`.

The SQL contains foreign keys, unique references, indexes, nonnegative incident count checks, seeded notice/purposes/provider register, and retention rows with unconfigured periods disabled. Provider records deliberately start at `REVIEW_REQUIRED`. The notice seed is a concise summary, not a counsel-approved complete notice.

The Prisma datasource uses PostgreSQL multi-schema configuration. Validate/generate with the repository's pinned Prisma 5.22 toolchain. Migration has not been applied to any database by this task.
