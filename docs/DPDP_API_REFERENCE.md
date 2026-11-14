# Privacy API reference

Base path: `/api/v1` (deployment may configure API version). Authenticated endpoints use the existing bearer JWT. Admin paths require the existing ADMIN role. Error responses use the application's standard API error envelope.

## Public / registration

- `GET /privacy/notice` — current notice version, title, body, policy URL, effective date.
- `POST /auth/register` — now requires `privacyNoticeAccepted: true` and the exact current `privacyNoticeVersion`; the receipt is recorded with timestamp and request metadata.

## Signed-in user

- `GET /privacy/me` — notice, enabled purposes, current choice, consent history, requests, grievances, active nominees.
- `PUT /privacy/me/consents/:purposeKey` — `{ "granted": true|false }`; appends a versioned affirmative choice. Essential purposes cannot be withdrawn here. Withdrawal of `notifications` also switches push categories off.
- `POST /privacy/me/requests` — access, correction, or deletion request (`type`, `subject`, `details`, optional `requestedFields`). This records a request; it does not itself erase data.
- `POST /privacy/me/grievances` — submit a privacy grievance; response includes a reference.
- `GET /privacy/me/export?format=json|csv` — streams only the signed-in person's scoped records, with private/no-store headers.
- `POST /privacy/me/nominees` and `DELETE /privacy/me/nominees/:id` — maintain up to five unverified nominees. No nominee data access is granted.

## Admin

All under `/admin/privacy`:

- `GET /overview`
- `GET /requests?status=&type=&search=&page=&limit=`
- `GET /grievances?status=&search=&page=&limit=`
- `GET /audit?search=&page=&limit=`
- `PATCH /requests/:id` and `PATCH /grievances/:id` for status/response. Deletion requests cannot be closed as completed from this screen; the UI has no erasure executor.
- `GET|PUT /processors` — review the provider register; values require human verification.
- `GET|PUT /retention` and `POST /retention/dry-run` — policy configuration/dry run only; no records are deleted.
- `GET|POST /breaches` and `PATCH /breaches/:id` — incident recordkeeping only; no external notifications are sent.

Check `src/routes/v1/privacy.routes.js`, `src/routes/v1/adminPrivacy.routes.js`, validators, and controller for exact payload validation before integrating another client.
