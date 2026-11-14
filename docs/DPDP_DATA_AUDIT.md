# Data inventory and access map

Engineering inventory for DPDP review; confirm with production configuration, vendors, and counsel. FitNerve is an Express + Prisma + PostgreSQL application. Firebase Admin is used for push notifications only; authentication is local password/JWT.

| Data group | Examples in schema | Main purpose | Access/notes |
|---|---|---|---|
| Account/authentication | `users`, `user_profiles`, refresh/OTP records | Account, authentication, verification | User self-service; admin operations; password hashes and token material are sensitive. |
| Fitness and health/activity | fitness profile, BMI/body/weight/calorie/step/activity records | Fitness features selected by user | User and assigned coach where applicable; health/activity is sensitive and needs a validated purpose/permission map. |
| Coaching | appointments, coach availability, assignments, reports | Booking and coaching | User, relevant coach, admins under role checks. |
| Communications | chat rooms/messages, support tickets, notifications/device tokens | Coaching/support/alerts | Participants and authorized support/admin; image files may be in external storage. |
| Progress media | media and progress photos | Profile and transformation tracking | Object store/local upload; URL signing/access behavior depends on configuration and route. |
| Commercial | payments, packages | Record payment outcomes and membership | User/admin; gateway and processor scope require deployment confirmation. |
| Integrations | Google Calendar connections, Meet integration, Gemini if configured, SMTP | Calendar/meeting, AI responses, email | Provider data, regions, retention, and contractual roles require vendor/account review. |
| Operational/security | activity/admin audit logs, device tokens, privacy logs | Security, support, accountability | Restrict staff access; define retention and backup lifecycle. |

The dedicated `privacy` schema adds versioned notices, acknowledgements, purposes, consent/withdrawal records, privacy requests, grievances, nominees, processor register, retention policies/runs, audit logs, and breach incidents. It contains user identifiers and should be treated as personal data.

See `DPDP_SECURITY_CHECKLIST.md` and `DPDP_LEGAL_REVIEW_REQUIRED.md`; this inventory is not proof that every live data flow or subprocessors have been discovered.
