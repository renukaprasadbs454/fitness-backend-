# Security checklist for privacy operations

## Implemented controls

- Existing JWT authentication and ADMIN role checks protect user/admin routes.
- User endpoints derive owner ID from authenticated identity, not request body.
- Export response uses private/no-store, attachment disposition, and scoped data filtering.
- Consent updates are transactional with withdrawal, notification preference shutdown, and audit event.
- Push-token registration is blocked without current affirmative notification-purpose consent.
- Input size/basic format validation, bounded search/pagination, unique grievance references, and audit records.
- Privacy schema separated from product tables; migration is additive.

## Verify before launch

- Review route-level rate limiting, staff role assignments, audit-log access, admin MFA/session policy, CSRF/origin protections for portal routes, and secrets rotation.
- Confirm upload/media authorization and signed URL lifetime, local static upload exposure, object-store region, backups, deletion propagation, CDN caches, and logs.
- Confirm export includes all relevant records but excludes other people's information; avoid logging export payloads.
- Threat-model nominee verification, access/correction requests, account erasure, incident response, processor access, and high-risk health/progress media.
- Configure monitoring/alerts and a human incident commander. Current breach UI is a register, not an external notification system.
- Keep database credentials, JWT keys, OAuth tokens, and FCM credentials out of source, output, and exports.

This checklist is not a security certification or legal sign-off.
