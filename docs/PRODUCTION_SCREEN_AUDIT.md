# FitNerve production screen and privacy audit

Audit date: 2026-11-13
Scope: source-code inspection and local validation of the `FRONTEND` and `BACKEND` repositories. No production database, deployment, containers, DNS, or secrets were changed.

## Executive result

FitNerve has working source screens for its main account, fitness, coaching, and administration journeys. The mobile/web client is Expo React Native/React Native Web; API and admin/coach portals are served by an Express 4 API process using Prisma/PostgreSQL. Authentication is application-managed email/password, OTP, and JWT. Firebase Admin is used for optional Firebase Cloud Messaging delivery; it is not the sign-in provider. Realtime chat uses Socket.IO.

This is not a public-release sign-off. Important operational and policy-dependent workflows remain incomplete: account deletion execution, retention enforcement, verified nominee authority, age/child policy, incident-notification delivery/evidence, provider verification, formal legal review, full-device journey testing, and iOS native release validation. A build or schema check cannot establish those controls.

## Application and navigation inventory

### Mobile and responsive web client

The shared Expo application registers these stack screens in `FRONTEND/src/navigation/AppNavigator.tsx`:

| Area | Screens/routes | Finding |
|---|---|---|
| Startup and account | Splash, Onboarding, Login, Register, VerifyOtp, ForgotPassword, ResetPassword | Present; registration includes an affirmative versioned privacy-notice acknowledgement. Email delivery and OTP policy require deployed SMTP verification. |
| Main navigation | MainTabs: Home, Workouts, Chat, Appointments, Profile; coach role receives Home, Chat, Appointments, Profile | Present; unread chat count is refreshed over Socket.IO and periodically. |
| Profile/coaching | EditProfile, Coaches, CoachDetail, CoachProfile, Booking, ScheduleSession, GoogleCalendarPreview | Present; actual OAuth redirect URI and Google account configuration must be verified per environment. |
| Fitness | BMICalculator, CalorieCalculator, Activity, ActivityFeed, ProgressTracker, TransformationHistory, TransformationSessionDetail | Present; Android Health Connect integration exists. Native Apple HealthKit integration was not found. |
| Workouts | AssignWorkout, WorkoutDetails, CreateCustomWorkout, CustomWorkoutDetails | Present; progress/session persistence is locally represented and completion is API-backed. Background execution and device-kill recovery still require native-device tests. |
| Engagement | Notifications, HelpCenter, Content, ContentDetail, Packages, PaymentMethods | Present. Notification preferences are available. Native push requires valid FCM credentials and device-token registration. |
| Privacy | Privacy | Present as a consolidated Profile → Privacy & Security screen. It includes consent, export, correction/deletion request, grievance, nominee, and request-history sections. |
| Resilience | AppErrorBoundary, API/network error handling, loading/empty states in data screens, SessionWatcher | Error boundary and session expiry handling exist. There is no dedicated maintenance or minimum-version/update screen. Offline behavior is generally an inline retry/error state, not a global offline screen. |

The app has a splash screen but no separate branded native welcome experience beyond Onboarding. Settings and account-security controls are distributed between Profile and Privacy rather than a separate account-settings screen. FAQs are provided through Help Center content; the exact production FAQ coverage/content is not verified here.

### Web and operations portals

- User-facing web is the React Native Web build of the same navigator and screens; it is not a separate React SPA.
- Admin and coach portals are static HTML/Alpine-style applications in `BACKEND/admin/admin.html` and `BACKEND/coach/coach.html`, served by the backend. Admin modules include dashboard, user/coach management, payments, audit logs, support, coach reports, media test, chat rooms, workout plans/exercises, database tables, and privacy management. Coach modules include dashboard, profile, availability, appointments, assigned clients, workout assignments, chat, and read-only coach directory. Coaches do not have access to the admin database-table panel.
- Web privacy policy is linked from the mobile/web privacy screen at `https://fitnerve.vercel.app/privacy-policy`; availability, accuracy, and version parity must be verified before release.

## Privacy and DPDP feature inventory

The database migration `prisma/migrations/20261113120000_dpdp_privacy_foundation/migration.sql` creates the PostgreSQL `privacy` schema and versioned notices, purpose catalogue, acknowledgements, append-only consent records/withdrawals, access/correction/deletion requests, grievances, nominees, processors, retention policies/runs, audit logs, and breach incidents. The migration is not applied to any database during this audit.

| Capability | Current implementation | Status and remaining work |
|---|---|---|
| Privacy notice | Current notice API and versioned registration acknowledgement; client links to full policy | Code present. Legal/product review of completeness, purposes, bases, language, and policy link required. |
| Consent | Purpose catalogue, affirmative records, current choice/history, withdrawal; withdrawing notification consent disables its channels | Implemented for the configured optional notification purpose. Other purpose-specific processing stops must be verified and linked to each actual consumer before release. OS permission prompts remain separate. |
| Personal data access/export | Authenticated owner-scoped JSON and human-readable CSV streaming; records include profile, fitness/activity, workout, coach/session, payment, chat, notification and relevant related data. Secret values are excluded; media bytes are included when readable, with warnings otherwise. | Implemented in code and unit-tested for record ownership. No persisted expiring download link is used because the API streams directly. Full subject/table mapping and third-party-held data boundaries still need operational review. |
| Correction | Direct profile editing plus privacy correction request, admin review and response | Intake/review is present; no correction execution engine exists. Admin must perform and evidence the correction. |
| Deletion | Authenticated request intake, duplicate active-request protection, admin tracking; UI explains it is a request only | **Not implemented end-to-end.** No verification/approval workflow, deletion job, retry/reconciliation, account/media/Firebase/provider cleanup, or legally-held-data manifest. Admin cannot mark deletion complete through the privacy panel. |
| Grievance | Reference-numbered intake, owner-scoped history, admin search/status/response | Workflow is present. Human coverage, response-time monitoring, escalation, and delivery evidence are not automated. |
| Nominee | Add/remove nominee records; dashboard labels them unverified | **Registration only.** No nominee email challenge, identity/authority verification, succession request, or access-grant workflow. A record grants no authority. |
| Retention | Configurable policy records; dry-run records a report | **Dry-run only.** Eligibility counts are null; no scheduler, enforcement, anonymisation, approval executor, or deletion evidence. Periods intentionally remain unset until reviewed. |
| Breach incidents | Admin creates and updates incident records, categories, status, investigation, containment, and notice timestamps | **Recordkeeping only.** No impact workflow, affected-person selection, outbound Board/data-principal notification, delivery receipts, deadline alerts, or 72-hour notification execution. Do not infer that timestamps mean notice was sent. |
| Processor register | Seeded Google, FCM, storage, SMTP, hosting entries, editable in admin | Entries are explicitly `REVIEW_REQUIRED`; locations, contracts, subprocessors, backups, and deletion terms are unverified. |
| Child/age controls | Registration collects age as fitness profile data where supplied | No verified age gate, guardian consent, child restrictions, or approved 18+ policy. Product owner and counsel must choose intended eligibility and safeguards. |
| Privacy audit | Privacy writes create privacy audit events; admin can list/search | Present for covered actions. Retention, access monitoring, tamper-resistance, and audit export/alert operations require deployment review. |

### Privacy APIs in this checkout

Routes are mounted under `/api/v1` by Express (`BACKEND/src/routes/v1/index.js`):

- `GET /privacy/notice`
- Authenticated: `GET /privacy/me`, `PUT /privacy/me/consents/:purposeKey`, `POST /privacy/me/requests`, `POST /privacy/me/grievances`, `POST /privacy/me/nominees`, `DELETE /privacy/me/nominees/:id`, `GET /privacy/me/export?format=json|csv`
- Admin-only: `GET /admin/privacy/overview`, list/patch requests and grievances, list audit events, get/update processors and retention policies, run retention dry-run, create/list/update breach incidents.

Authentication and authorization are JWT middleware plus admin role middleware in this implementation, not Firebase ID-token verification. User data routes use the authenticated `req.user.id` for ownership. Deployment must keep TLS, secrets, CORS origins, rate limits, database access, object-store permissions, backups, SMTP, and optional FCM configuration correct.

## System states and external dependencies

- API health route exists. The app has local loading, empty, retry/error and expired-session handling. No explicit maintenance-mode or force-update route/screen was found.
- Permission-denied and Health Connect-not-installed messaging is handled in the Android activity integration. Location services are not part of the enumerated core screen flow; no global location-disabled screen was found.
- Push delivery depends on `FCM_SERVICE_ACCOUNT_BASE64` and client device registration. A blank value disables remote push; in-app notifications remain available.
- Google Calendar/Meet, SMTP, configured S3-compatible media storage, payment provider, hosting/VPS, and optional AI provider must be treated as external processors where configured. Credentials, contracts, region, data lifecycle, and production callbacks are not verified by source build checks.
- Android has Health Connect support; iOS HealthKit parity was not found. Expo web rendering is not equivalent to native iOS/Android permission or background behavior.

## Changes made during this audit

- Fixed malformed account-deletion confirmation JSX in `FRONTEND/src/screens/PrivacyScreen.tsx`.
- Corrected persisted custom-workout session typing and exercise completion-state fallback in `CustomWorkoutDetailsScreen.tsx`.
- Replaced unsupported Material Community icon names in `CustomWorkoutDetailsScreen.tsx` and `ProfileScreen.tsx`.
- Normalized nullable workout calories before assigning numeric UI state in `WorkoutDetailsScreen.tsx`.
- Updated `FRONTEND/tsconfig.json` to exclude generated Expo output and generated native build directories from source TypeScript checking.
- Added `FRONTEND/src/components/AppErrorBoundary.tsx` and privacy API client integration in the current working tree.
- Added this screen/readiness audit. Existing DPDP migration, APIs, privacy UI, admin management, data export, and two focused service tests were already present in the working tree and are described accurately above.

No new dependencies were introduced for the changes listed here. No production deployment or migration was performed.

## Verification results

| Check | Result |
|---|---|
| Frontend TypeScript (`npx tsc --noEmit --pretty false`) | Passed after excluding generated output. |
| Expo web export (`npm run build:web`) | Passed; app bundled successfully. |
| Expo Android JS export (`npx expo export -p android`) | Passed; validates JS bundling, not a signed APK/native permissions. |
| Backend tests (`npm test`) | Passed: 6 tests covering consent withdrawal, export isolation, correction request intake, duplicate deletion prevention, nominee owner-scoping, and preventing admin approval/completion of destructive deletion work. |
| Backend lint (`npm run lint`) | Passed: 0 errors, 5 warnings in existing chat/coach/support code. |
| Prisma schema validation (`npx prisma validate`) | Passed. |
| Prisma client generation (`npx prisma generate`) | Passed in this checkout. |
| Changed backend source syntax (`node --check`) | Passed for privacy service/controller/export service. |
| Production database / deployment | Not run. |
| Real mobile/web end-to-end, SMTP, FCM, Google OAuth, storage, payment-provider or permission journeys | Not run; require configured services/accounts/devices. |

## Release readiness by target

| Target | Assessment |
|---|---|
| Android | Source and JS bundle readiness can be checked locally. A production signed APK, install/upgrade test, Health Connect permission flow, app-kill workout recovery, FCM delivery, and Play policy review remain required. |
| iOS | Not release-validated. No local Xcode/macOS archive/device run; Apple HealthKit support was not found. Native signing, permissions, background behavior, APNs, and TestFlight review remain. |
| Web | Shared web bundle compilation can be checked locally. Browser end-to-end journeys, production domains/CORS, OAuth redirects, deep links, accessibility, and deployment cache behavior remain to be verified. |
| Backend/admin/coach | Schema, lint, and focused tests pass. Apply migration only through the approved deployment process; verify production secrets/SMTP/FCM/storage/Google OAuth, backup restoration, monitoring, rate limits, authorization, and provider lifecycle before launch. |
| DPDP operations | Not ready for a compliance claim until the listed deletion, retention, nominee, breach, age-policy, processor, notice, legal, and operational evidence gaps are closed. |

## Required release blockers and owners

1. **Product + counsel:** approve data purposes/lawful bases, complete notice and privacy policy, language/accessibility, child eligibility/guardian approach, nominee authority rules, retention periods and legal holds, grievance process, and statutory role/applicability.
2. **Backend + security:** implement identity-verified account deletion with transactional stages, provider/media cleanup, retries, partial-failure recovery, legal-retention exceptions, and auditable completion; add real retention eligibility/enforcement behind reviewed periods and explicit approval; add incident deadline tracking and notification delivery receipts.
3. **Operations/procurement:** verify every processor/subprocessor, region, contract, transfer basis, backup lifecycle, deletion path, on-call owner, restore procedure, and breach contact route. Replace `REVIEW_REQUIRED` records only with evidence.
4. **Mobile/web:** validate push registration/permissions, Android Health Connect, iOS health strategy, offline/session-expired flows, responsive/accessibility behavior, deep links, file/media handling, and workout persistence on real devices/browsers.
5. **Release engineering:** production signing and store metadata/review, deployment migration/rollback rehearsal, production CORS/OAuth redirect configuration, monitoring/alerts, backup restore, and smoke-test runbook.

## Source references

- Main mobile/web route registry: `FRONTEND/src/navigation/AppNavigator.tsx`.
- User screens: `FRONTEND/src/screens/`.
- Admin and coach portal screens: `BACKEND/admin/admin.html`, `BACKEND/coach/coach.html`.
- API route registry: `BACKEND/src/routes/v1/index.js`.
- Privacy API/controller/service: `BACKEND/src/routes/v1/privacy.routes.js`, `BACKEND/src/routes/v1/adminPrivacy.routes.js`, `BACKEND/src/controllers/privacy.controller.js`, `BACKEND/src/services/privacy.service.js`.
- Database model and migration: `BACKEND/prisma/schema.prisma`, `BACKEND/prisma/migrations/20261113120000_dpdp_privacy_foundation/migration.sql`.
- Deployment/legal notes: `BACKEND/docs/DPDP_DEPLOYMENT.md`, `BACKEND/docs/DPDP_LEGAL_REVIEW_REQUIRED.md`.
