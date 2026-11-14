# Deployment and migration notes

This change has not been deployed and its migration has not been applied. Use the existing approved backend release procedure after code review and a tested backup.

1. Review the migration and confirm PostgreSQL supports the existing Prisma multi-schema configuration.
2. Obtain legal/product approval for the notice body, public policy URL, purpose classifications, child policy, processor records, and retention periods. The current retention rows are intentionally disabled/unconfigured.
3. Back up and verify restore procedure for the target database.
4. Build and deploy the backend using the normal pipeline. Run `npx prisma migrate deploy` (or the repository deployment script's migration step) against the intended database only; never run `migrate reset` in production.
5. Deploy the matching frontend so registration sends the notice version and users can manage privacy settings.
6. Verify `/api/v1/privacy/notice`, registration acknowledgement, privacy dashboard, consent withdrawal/push preference behavior, user-scoped exports, admin role protection, and admin workflows in a staging environment.
7. Confirm rollback plan with the operator. Rolling application code back does not automatically remove schema/data; do not drop the `privacy` schema as a rollback shortcut.

The current code has operational gaps documented in `DPDP_IMPLEMENTATION.md`; deployment alone does not make the service fully compliant.
