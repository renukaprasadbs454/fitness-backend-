# Fit Nerve staging hardening and release validation

**Checked:** 2026-11-13
**Environment:** local Windows checkout only. No staging database/provider configuration was confirmed. Production was not contacted, deployed to, or migrated.

## Release recommendation

**BLOCKED — not eligible for controlled production deployment yet.** Local backend checks and web/Android bundles build, but account deletion is not implemented end to end; retention is dry-run only; child/guardian verification and breach notice delivery are incomplete; no isolated staging environment was verified; dependency advisories remain; and a physical-device/web journey plus iOS build were not verified. The Android APK built successfully but is signed with the debug signing configuration, so it is not a production release artifact.

## 1. Previous blockers and resolved items

| Area | Status | Evidence / remaining work |
|---|---|---|
| DPDP groundwork, data export, correction and privacy request workflow | PARTIALLY COMPLETE | Existing privacy APIs and migration are present; tests cover owner-scoped export, correction requests, consent withdrawal and deletion-request handling. A request is not actual deletion. |
| Session revocation on HTTP authentication | COMPLETE (existing implementation) | HTTP refresh-token session checks are present. |
| Socket.IO session revocation | COMPLETE (fixed in this pass) | Socket handshake previously accepted a signed token without checking its refresh-token session. It now checks session existence, ownership, expiry, revocation and active-user state. Regression tests cover those cases and legacy short-lived tokens. |
| CORS policy | PARTIALLY COMPLETE | CORS unit tests pass for exact allow-list behavior, fail-closed production configuration, origin-less clients and opted-in loopback previews. Public/staging ingress behavior is not verified. |
| Privacy migration | BLOCKED for staging verification | Prisma schema validates, but no explicitly configured staging database was available; no migration was applied. |

## 2. Account deletion

**Status: PARTIALLY COMPLETE.** The authenticated user can submit and track a deletion request; duplicate active requests are rejected, and the admin privacy console prevents marking deletion complete or approving destructive operations. The existing design deliberately does not perform account erasure.

**Not implemented/verified:** explicit re-authentication, a dependency-complete deletion/anonymization plan, file and external-provider deletion, retention/legal-hold decisions, transactional idempotent execution, retryable jobs, post-deletion access prevention, and multi-account isolation tests against a database. These require a retention schedule, legal-hold rules, processor deletion contracts and an isolated test database. Enabling destructive erasure without those is unsafe.

## 3. Retention engine

**Status: PARTIALLY COMPLETE.** A dry-run/audit foundation is documented in the existing DPDP implementation. There is no verified production-grade scheduled executor with approved per-category periods, legal holds, archive/anonymize behavior, retries and admin execution visibility. No destructive cleanup was run.

## 4. Children’s data safeguards

**Status: BLOCKED.** Current profile/onboarding does not establish a verified age-and-guardian workflow. There is no configured verifiable-parental-consent provider or evidenced verification process. No guardian was marked verified, and no provider or age policy was invented. A DOB field by itself would not close this blocker.

## 5. Breach response

**Status: PARTIALLY COMPLETE.** The repository has privacy/breach groundwork and incident records, but the complete operational workflow is not verified: affected-person/data identification, investigation/containment timeline, escalation, notice preparation, configured delivery, provider-confirmed receipts, failures/retries and end-to-end audit evidence. No notification is claimed as delivered. Notification providers and applicable legal deadlines must be configured and legally approved first.

## 6. Dependency advisories

**Status: BLOCKED — remediation remains.** Fresh `npm audit --omit=dev` reports **9 moderate, 0 high, 0 critical** production dependency advisories. The full dependency tree reports **10 moderate** (the additional advisory affects development tooling). `npm audit fix --dry-run` proposed no package changes; no forced overrides or major upgrades were applied.

| Package / path | Advisory | Finding |
|---|---|---|
| `aws-sdk@2.1693.0` (direct) → `uuid@8.0.0` | AWS SDK v2 region validation; vulnerable UUID buffer bounds | Fix path reported by npm requires a major SDK change. Storage uses SDK v2 URL/upload/delete flows; migrating to AWS SDK v3 requires a reviewed async/API refactor and integration regression coverage. |
| `swagger-jsdoc@6.3.0` (direct) → `glob@11.1.0`, `minimatch` | Glob cancellation bypass; minimatch globparts amplification | Available fixes require changing transitive versions beyond the currently resolved ranges. No untested override was introduced. |
| `@google-cloud/firestore-api` → `gaxios`, `gcp-metadata`, `google-gax`, `rimraf`, `glob`, `minimatch` | Transitive glob/minimatch advisories | npm marks compatible fixes available for some paths, but dry-run changed no packages. Resolve with a controlled lockfile update and regression checks for Firebase/Google integrations. |
| `nodemon` (development dependency) → `minimatch` | minimatch globparts amplification | Included in full-tree count, not production-only count. Update development tooling and re-audit. |

Exact package paths and advisory URLs are available from `npm audit --omit=dev --json` in the backend checkout. Re-run after the planned SDK and lockfile changes; do not treat moderate severity as a waiver.

## 7. Security and authorization review

**Status: PARTIALLY COMPLETE.** The session gap found in the Socket.IO handshake is fixed and has regression tests. Existing automated tests cover CORS policy, privacy ownership boundaries, registration validation and privacy console safeguards. A complete route-by-route and event-by-event penetration/authorization review has not been completed. Cross-user access, privilege escalation, admin/coach boundaries, file authorization, rate limits and socket room/event ownership still require integration tests against staging data.

## 8. Staging configuration and operations

**Status: BLOCKED.** Repository inspection found a production Compose file, but no dedicated staging Compose file or named staging config file. The local `.env` files were not read for values and are not evidence of staging; no production secrets or customer data were used by the checks. No separate staging database/provider configuration was confirmed.

Before staging verification, provide an isolated database and staging-only credentials/endpoints for Firebase Authentication, email/SMS, push notifications, storage, Google OAuth/Calendar, and frontend API origin. Configure migration target explicitly, health checks, logs/monitoring, backup/restore evidence and generated test accounts. The production database was not contacted and migrations were not applied.

## 9. Database migration results

**Status: PARTIALLY COMPLETE.** `npx prisma validate` passed. The existing DPDP migration was inspected as part of the repository audit. It was not applied because a confirmed isolated staging `DATABASE_URL` was unavailable. There are no staging migration/restore results to report.

## 10. End-to-end results

**Status: BLOCKED for full journey.** Automated local checks passed (see below), but no full UI journey was run against a real isolated staging backend. Registration/OTP delivery, fitness providers, chat sockets, notifications, payment flows, privacy request resolution, retention execution, breach provider recovery, backup/restore, and destructive account deletion remain unverified. No mocked provider result is presented as a live integration.

## 11. Android

**Status: PARTIALLY COMPLETE.** Expo Android export succeeded. `gradlew.bat assembleRelease` succeeded on the existing native project; output APK:

`FRONTEND/android/app/build/outputs/apk/release/app-release.apk` (about 100 MB).

`apksigner verify --verbose` succeeded with one signer. Inspection of `android/app/build.gradle` shows the release variant uses `signingConfigs.debug`; therefore the APK is suitable only for local validation, not distribution. No Android device/emulator was attached (`adb devices -l` listed none). Permissions, notifications, deep links, offline states and install/upgrade behavior were not device-tested. Production signing credentials and an Android device/emulator are still required.

## 12. iOS

**Status: BLOCKED / REQUIRES EXTERNAL VERIFICATION.** This Windows environment has no Xcode/`xcodebuild`. iOS native compilation, signing, APNs, permission prompts, deep links and physical-device behavior remain unverified and require a macOS/Xcode runner and Apple signing configuration.

## 13. Web

**Status: PARTIALLY COMPLETE.** `npx tsc --noEmit --pretty false` passed and `npm run build:web` (`expo export -p web`) completed successfully. This verifies type-check/build only. Routes, responsive browser flows, authentication, privacy actions, CORS through real staging ingress, browser security and API/provider integration were not exercised against staging.

## 14. Legal and vendor approvals

**Status: REQUIRES EXTERNAL VERIFICATION.** Technical implementation is not a legal compliance determination. Counsel and business owners must approve:

- Privacy notice, consent language, purposes, minimization and retention periods.
- Children’s eligibility/guardian evidence workflow and prohibited-processing controls.
- Grievance contact, escalation and resolution timeframes.
- Breach classification, statutory timelines, notice content and delivery evidence.
- Processor contracts and deletion/retention capabilities for Firebase, Google, email/SMS, push and storage providers.
- Cross-border processing, Significant Data Fiduciary applicability and Consent Manager obligations.
- Legal holds and statutory retention exceptions.

Official source references checked for this review: [DPDP Act commencement notification (eGazette)](https://egazette.gov.in/WriteReadData/2025/267647.pdf), [MeitY DPDP Rules, 2025](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf?v=20261027115856), and [MeitY notifications](https://www.meity.gov.in/whats-new). Counsel should verify applicability and commencement dates before launch.

## 15. Checks actually run

| Check | Result |
|---|---|
| Backend `npm test` | PASS — 19 tests, 0 failed (includes new Socket.IO session checks). |
| Backend `npm run lint` | PASS — 0 errors; 5 existing warnings in `chat.service.js`, `coachDb.service.js`, `support.service.js`. |
| Backend `npx prisma validate` | PASS — schema valid. |
| Frontend `npx tsc --noEmit --pretty false` | PASS. |
| Frontend `npm run build:web` | PASS — Expo web export completed. |
| Frontend `npx expo export -p android` | PASS — Android JS bundle and assets exported. |
| Android `gradlew.bat assembleRelease` | PASS — build completed; debug signer means not production distributable. |
| Android APK signature verification | PASS — APK signature verifies; this does not make the debug key production-ready. |
| Backend `npm audit --omit=dev` | FAIL release gate — 9 moderate advisories remain. |
| Device/system E2E | NOT RUN — no Android device/emulator; no iOS/Xcode; no confirmed staging environment. |

## 16. Remaining blockers

1. Approve retention categories, periods, legal holds and processor deletion contracts; then implement and test real idempotent deletion and scheduled retention on isolated test data.
2. Configure a real, legally reviewed child/guardian verification workflow before accepting child accounts.
3. Configure breach delivery providers and provider receipt handling; validate statutory policy with counsel.
4. Remediate the nine production moderate advisories without unreviewed overrides; migrate AWS SDK v2 with storage integration tests.
5. Provision isolated staging infrastructure and run migrations, backup/restore, integration tests and all user/privacy/security/operations journeys there.
6. Complete route/socket/file authorization integration testing for user, coach and admin roles.
7. Configure production Android signing, install and test on a device/emulator; validate iOS on macOS/Xcode.
8. Obtain legal and vendor approvals listed above.

## 17. Final status

| Platform / area | Status |
|---|---|
| Backend code checks | PARTIALLY COMPLETE |
| Isolated staging | BLOCKED |
| Android build | PARTIALLY COMPLETE (debug-signed; no device test) |
| iOS | BLOCKED / REQUIRES EXTERNAL VERIFICATION |
| Web build | PARTIALLY COMPLETE (no live staging flow verification) |
| DPDP operational/legal readiness | BLOCKED / REQUIRES EXTERNAL VERIFICATION |
| Controlled production deployment eligibility | **NO** |
