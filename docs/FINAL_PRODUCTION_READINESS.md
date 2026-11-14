# FitNerve Final Production Readiness

**Review date:** 2026-11-13
**Scope:** current local working tree in `BACKEND` and `FRONTEND`; no deployment, production database access, migration execution, or credential inspection was performed.
**Release decision:** **NOT READY for public production release.** Multiple material privacy workflows, third-party operations, native release checks, and deployment evidence remain incomplete.

## 1. Initial blockers identified

- Account deletion was request intake only; no safe, retryable, legally-aware erasure process was present.
- Retention configuration had no policy periods or deletion/anonymization executor; dry-run reported no eligible counts.
- Nominee records were unverified and did not grant authority.
- Breach incidents were recordkeeping only; no notification sending, provider receipts, or deadline alerts.
- Age eligibility and guardian handling were not defined or enforced.
- Processor entries were marked `REVIEW_REQUIRED`; contract, location, subprocessor and retention evidence were missing.
- Full cross-account authorization and provider/device journeys were not demonstrated by automated integration tests.
- Production CORS policy failed open when the origin allow-list was empty.
- Dependency audit reported a high Zod advisory and moderate production dependency advisories.
- Native Android/iOS release and real-device verification were incomplete.

## 2. Changes completed in this final phase

- Changed Express browser CORS and Socket.IO CORS to the same exact-origin allow-list. Empty production allow-list now rejects browser origins; requests without `Origin` remain supported for native clients, health checks and server-to-server calls. Localhost is only allowed in production when `ALLOW_LOCALHOST_CORS=true` is explicitly set.
- Added CORS regression coverage for empty-list fail-closed behavior, exact origins, no-Origin clients, and opted-in localhost.
- Upgraded `bcrypt` from 5.1.1 to 6.0.0, removing its vulnerable `node-pre-gyp`/`tar` dependency chain; updated the package install-script allow-list.
- Upgraded Zod to 4.6.7 and adjusted the registration privacy-acknowledgement validation option to Zod 4. Added tests for normalized registration input, default role, and readable consent validation errors.
- Applied compatible npm audit fixes for vulnerable transitive package versions.
- Preserved the pre-existing DPDP implementation and prior uncommitted changes; no force audit fix or breaking AWS SDK migration was applied.

## 3. DPDP capabilities and account deletion/retention

| Capability | Status | Evidence / limitation |
|---|---|---|
| Versioned privacy notice and registration acknowledgement | PARTIALLY COMPLETE | Implemented in existing API and app. Notice purposes, wording, accessibility and policy URL need counsel/product approval. |
| Purpose-based consent record and withdrawal | PARTIALLY COMPLETE | History and withdrawal are implemented; notification-channel withdrawal is applied transactionally. Other purposes need their consumers wired to enforce withdrawal. |
| Owner-scoped personal data access/export | PARTIALLY COMPLETE | JSON and human-readable CSV exports exist; tests verify owner filtering for covered records. Complete table/provider/backup scope needs a data-owner review. |
| Profile correction | PARTIALLY COMPLETE | Profile edit and correction request/review exist. There is no automatic correction executor or completion evidence. |
| Account deletion | BLOCKED | Request intake, duplicate protection and admin tracking exist. There is no identity re-verification, legally reviewed exception/hold model, provider/media cleanup, transactional staged deletion, retry/reconciliation, minimal audit strategy validation, or end-to-end deletion test. Deletion was deliberately not made executable without those policy decisions. |
| Retention | BLOCKED | Policies and dry-run UI exist, but periods are unset and dry-run does not count eligible records. No scheduled personal-data deletion/anonymisation executor or legal-hold handling is implemented. Existing expired OTP/session cleanup is separate technical cleanup, not a complete personal-data retention program. |
| Grievance tracking | PARTIALLY COMPLETE | User intake/history and admin review/status/response exist. Human coverage, approved response deadlines, escalation and delivery evidence remain operational tasks. |
| Nominee management | PARTIALLY COMPLETE | User can add/remove unverified records. Identity/authority verification, succession request and any disclosure workflow are absent. |
| Breach incident handling | PARTIALLY COMPLETE | Admin incident log and investigation/containment fields exist. No outbound Board/data-principal delivery integration, receipts, deadline alerting, affected-person workflow or tested notification procedure exists. |
| Child/guardian safeguards | BLOCKED | Intended age eligibility is not defined, and age verification/guardian consent safeguards are absent. Product and counsel must define the service policy before implementation can be safely completed. |
| Processor register | PARTIALLY COMPLETE | Google, FCM, object storage, SMTP and hosting are inventoried in the existing UI; all unverified entries remain `REVIEW_REQUIRED`. No vendor certification or contract is inferred. |

The app uses authenticated application JWTs and password/email OTP. Firebase Admin is used for optional push delivery, not user sign-in. Privacy routes derive user ownership from authenticated user id; admin privacy routes use the existing authenticated admin guard. Focused service tests exist, but comprehensive HTTP/database authorization tests are still absent.

## 4. Security and dependency review

| Area | Status | Findings |
|---|---|---|
| CORS | COMPLETE for source behavior | Fail-closed browser origin allow-list now shared by HTTP and Socket.IO. Deployment must configure exact production web origins and proxy Socket.IO correctly. |
| Authentication/session | PARTIALLY COMPLETE | Existing JWT, OTP and refresh-token flows remain. Full expiry, revocation, brute-force, account-takeover, production-secret and database-failure integration testing is still required. |
| Authorization/IDOR | PARTIALLY COMPLETE | Privacy service ownership scoping and existing role middleware reviewed. No exhaustive route-by-route cross-account integration test is available. |
| File upload/storage | PARTIALLY COMPLETE | Existing storage validates image bytes and enforces configured upload limit; real S3-compatible bucket policy, signed URL ownership, lifecycle, malware policy and deletion were not exercised. |
| Input validation | PARTIALLY COMPLETE | Zod 4 upgrade verified against shared validation middleware and registration inputs. This does not constitute full API fuzzing or route coverage. |
| Logging/secrets | REQUIRES EXTERNAL VERIFICATION | No `.env` values were printed or changed. Production secret rotation, log retention/access, redaction, alerting and host access remain operator checks. |
| Dependency audit | PARTIALLY COMPLETE | `npm audit --omit=dev` reports 9 moderate findings and 0 high/critical after updates. Findings include AWS SDK v2/UUID and Google/Firebase or Swagger-related transitive packages. A breaking major AWS SDK swap was not attempted without storage integration coverage. Re-run audit at release time. |
| Rate limiting | PARTIALLY COMPLETE | Existing global/auth limits remain. Distributed multi-instance behavior and abuse thresholds need staging/load verification. |

## 5. Mobile and web readiness

The current app is a shared Expo React Native / React Native Web client. Existing navigation and screens are inventoried in [PRODUCTION_SCREEN_AUDIT.md](PRODUCTION_SCREEN_AUDIT.md). The current working tree also contains earlier fixes for API auth/session handling, workout-state persistence, app error boundary, and privacy API/UI. This final phase did not claim a full visual or device-level screen audit.

| Target/check | Status | Evidence / remaining work |
|---|---|---|
| Web compile/export | COMPLETE for bundle | `npm run build:web` succeeded. No browser end-to-end suite ran. Production-origin/CORS, route refresh, accessibility, live APIs, chat, OAuth, images and payment journeys need staging browser validation. |
| Android JavaScript export | COMPLETE for bundle | `npx expo export -p android` succeeded. This is not a signed APK, install/upgrade test, store bundle, Health Connect permission test, push test or background execution test. |
| Android release | REQUIRES EXTERNAL VERIFICATION | Confirm production API configuration, signing key/build profile, package id, permissions, app links, privacy disclosures, release artifact, install/upgrade, Health Connect, FCM and workout recovery on supported devices; then Play Console review. |
| iOS | BLOCKED for release sign-off | No macOS/Xcode archive or real-device test was run. HealthKit parity was not found in the source audit. Validate bundle/signing, privacy manifests, permissions, APNs, deep links, background behavior and store review on Apple hardware. |
| Auth/onboarding/privacy UI | PARTIALLY COMPLETE | Screens and API integrations exist. Actual OTP email, notice/purpose correctness, consent enforcement and complete account-deletion journey require staging/provider tests and approved policy. |
| Offline, maintenance and update states | PARTIALLY COMPLETE | Inline loading/error/retry and session expiry handling exist. Dedicated maintenance and minimum-version enforcement are absent. |
| Notification/chat/health/provider journeys | REQUIRES EXTERNAL VERIFICATION | Requires production-like SMTP, FCM, Socket.IO proxy, Health Connect, storage and OAuth accounts/devices; not exercised here. |

No extra frontend dependencies were introduced during this final phase.

## 6. Backend, database and migration

- Backend stack remains Node.js/Express 4, Prisma 5.22, PostgreSQL and Socket.IO.
- The existing privacy migration creates privacy schema records for notices, purposes, consents/withdrawals, rights requests, grievances, nominees, processor inventory, retention, audit and breach incidents.
- `npx prisma validate` and `npx prisma generate` passed locally.
- The privacy migration was **not applied** to local, staging or production databases during this phase. Production schema/data were not accessed or changed.
- Existing health endpoint, pagination and global error handler remain. Backup restoration, migration/rollback rehearsal, database failover, observability and recovery-time objectives were not verified.
- No production deployment or Git push was performed.

## 7. Automated checks actually run

| Check | Result |
|---|---|
| Backend `npm test` (final run) | Passed: 12 tests, 0 failed. |
| Backend `npm run lint` | Passed: 0 errors, 5 pre-existing warnings in chat, coach DB and support services. |
| Prisma `npx prisma validate` | Passed. |
| Prisma `npx prisma generate` | Passed. |
| bcrypt 6 local hash/compare smoke check | Passed. |
| Backend `npm audit --omit=dev` | 9 moderate, 0 high, 0 critical remaining at time of run. |
| Frontend `npx tsc --noEmit --pretty false` | Passed (no diagnostics). |
| Frontend `npm run build:web` | Passed; Expo web export completed. |
| Frontend `npx expo export -p android` | Passed; Android bundle export completed. |
| Real HTTP/database/mobile journeys | Not run; no live test DB, provider accounts or device test was used. |

## 8. Current legal timing review and counsel checklist

Official MeitY material lists the DPDP Act commencement notification and a 2025 Rules corrigendum; the Act and Rules have staged commencement. Do not treat every provision as already operative based only on enactment/publication. Counsel must check the live Gazette text, corrigendum and any later order against the proposed launch date and FitNerve's role/applicability. The official MeitY page also lists a 2026 “Removal of Difficulties” Order, whose applicability and effect on commencement/transitional obligations must be reviewed before any legal timeline claim.

Official references checked on 2026-11-13:

- [DPDP Act commencement notification, Gazette G.S.R. 843(E)](https://egazette.gov.in/WriteReadData/2025/267647.pdf)
- [DPDP Rules, 2025, MeitY-hosted Gazette copy, G.S.R. 846(E)](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- [MeitY DPDP Rules page and listed corrigendum](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025)
- [MeitY latest notices page, including 2026 Removal of Difficulties Order](https://www.meity.gov.in/whats-new)

Before release, Indian privacy counsel and accountable management should approve:

1. Data Fiduciary/processor roles, applicability, purposes and lawful grounds for every data category.
2. Current and corrected notice text, layered/accessible wording, collection points, retention disclosures and privacy contact.
3. Age eligibility, child/guardian safeguards, whether any exemption applies, and treatment of age/health data.
4. Retention periods, statutory exceptions, legal holds, backups, deletion evidence, anonymization and processor deletion.
5. Consent purposes and actual withdrawal effects, including non-essential analytics/notifications/integrations.
6. Grievance ownership, response timelines, escalation, communication delivery evidence and Board contact process.
7. Breach classification, internal escalation, legal deadlines, affected-person and Board notices, receipts and exercise evidence.
8. Nominee scope, identity/authority checks, deceased/incapacitated-user workflow and permitted disclosure.
9. Processor/subprocessor contracts, processing regions, transfer analysis, security controls, backups and exit/deletion clauses.
10. Significant Data Fiduciary designation/applicability, if any, and any additional obligations.
11. Corrigendum and 2026 Removal of Difficulties Order effect on the planned launch and transition dates.

This code review does not establish legal compliance.

## 9. Infrastructure and deployment requirements

- Define production `CORS_ALLOWED_ORIGINS` with exact app/web portal origins; leave `ALLOW_LOCALHOST_CORS=false` in production.
- Configure a strong unique JWT access/refresh secret pair, database credentials, SMTP, FCM, object storage, Google OAuth redirect and payment settings through a secret manager; do not commit them.
- Verify HTTPS, reverse-proxy forwarded headers, WebSocket/Socket.IO upgrade handling, request/body limits, rate-limit behavior across replicas, health checks and log redaction.
- Apply the privacy migration through a reviewed staging rehearsal with backup and rollback procedure before production.
- Verify durable private storage and subject-owned signed media URLs; test failed uploads, deletion and object lifecycle behavior.
- Test backup restore, database recovery, cron/worker idempotency, monitoring alerts and incident ownership.
- Run production-like browser/device smoke journeys after deployment approval. This report performed no deployment.

## 10. Remaining blockers and final recommendation

**Critical release blockers:** end-to-end account deletion; approved and enforced retention/legal holds; child/age policy and safeguards; incident notification operations; complete authorization integration coverage; processor/cross-border contract review; migration and backup recovery rehearsal; production provider/device tests; signed Android release verification; and iOS/Xcode release validation.

**Recommendation:** continue in controlled development/staging. Do not publicly release or claim DPDP compliance until the critical blockers have owners, evidence and tests. Android and web source bundles compile, but neither platform has full release sign-off. iOS is not release-validated. Backend schema/tests pass for limited covered cases, but database migration and production behavior remain unverified.
