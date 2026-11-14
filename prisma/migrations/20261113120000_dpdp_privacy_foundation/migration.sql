CREATE SCHEMA IF NOT EXISTS privacy;

CREATE TABLE privacy.privacy_notices (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  policy_url TEXT,
  is_current BOOLEAN NOT NULL DEFAULT false,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX privacy_notices_current_effective_idx ON privacy.privacy_notices(is_current, effective_at);

CREATE TABLE privacy.privacy_notice_acknowledgements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notice_id TEXT NOT NULL REFERENCES privacy.privacy_notices(id) ON DELETE RESTRICT,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  collection_point TEXT NOT NULL DEFAULT 'registration',
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX privacy_notice_ack_user_time_idx ON privacy.privacy_notice_acknowledgements(user_id, acknowledged_at);

CREATE TABLE privacy.privacy_purposes (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  data_categories TEXT[] NOT NULL DEFAULT '{}',
  essential BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE privacy.privacy_consent_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  purpose_key TEXT NOT NULL REFERENCES privacy.privacy_purposes(key) ON DELETE RESTRICT,
  notice_id TEXT NOT NULL REFERENCES privacy.privacy_notices(id) ON DELETE RESTRICT,
  granted BOOLEAN NOT NULL,
  affirmative BOOLEAN NOT NULL DEFAULT true,
  collection_point TEXT NOT NULL DEFAULT 'privacy_dashboard',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX privacy_consent_records_user_purpose_created_idx ON privacy.privacy_consent_records(user_id, purpose_key, created_at);

CREATE TABLE privacy.privacy_consent_withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  consent_record_id TEXT NOT NULL REFERENCES privacy.privacy_consent_records(id) ON DELETE RESTRICT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX privacy_consent_withdrawals_user_created_idx ON privacy.privacy_consent_withdrawals(user_id, created_at);

CREATE TABLE privacy.privacy_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  subject TEXT,
  details TEXT,
  requested_fields TEXT[] NOT NULL DEFAULT '{}',
  response TEXT,
  handled_by_id TEXT,
  handled_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX privacy_requests_type_status_created_idx ON privacy.privacy_requests(type, status, created_at);
CREATE INDEX privacy_requests_user_created_idx ON privacy.privacy_requests(user_id, created_at);

CREATE TABLE privacy.privacy_grievances (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  response TEXT,
  handled_by_id TEXT,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX privacy_grievances_status_created_idx ON privacy.privacy_grievances(status, created_at);
CREATE INDEX privacy_grievances_user_created_idx ON privacy.privacy_grievances(user_id, created_at);

CREATE TABLE privacy.privacy_nominees (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  relationship TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  verification_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX privacy_nominees_user_active_idx ON privacy.privacy_nominees(user_id, is_active);

CREATE TABLE privacy.privacy_processors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  service TEXT NOT NULL,
  purposes TEXT[] NOT NULL DEFAULT '{}',
  data_categories TEXT[] NOT NULL DEFAULT '{}',
  storage_locations TEXT[] NOT NULL DEFAULT '{}',
  safeguards TEXT,
  retention_and_delete TEXT,
  contract_status TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED',
  last_reviewed_at TIMESTAMPTZ,
  updated_by_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE privacy.privacy_retention_policies (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  period_days INTEGER,
  basis TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  updated_by_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT privacy_retention_period_nonnegative CHECK (period_days IS NULL OR period_days >= 0)
);

CREATE TABLE privacy.privacy_retention_runs (
  id TEXT PRIMARY KEY,
  dry_run BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by_id TEXT,
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMPTZ
);
CREATE INDEX privacy_retention_runs_status_started_idx ON privacy.privacy_retention_runs(status, started_at);

CREATE TABLE privacy.privacy_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  subject_type TEXT,
  subject_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX privacy_audit_logs_created_idx ON privacy.privacy_audit_logs(created_at);
CREATE INDEX privacy_audit_logs_user_created_idx ON privacy.privacy_audit_logs(user_id, created_at);
CREATE INDEX privacy_audit_logs_action_created_idx ON privacy.privacy_audit_logs(action, created_at);

CREATE TABLE privacy.privacy_breach_incidents (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'DISCOVERED',
  discovered_at TIMESTAMPTZ NOT NULL,
  occurred_at TIMESTAMPTZ,
  summary TEXT NOT NULL,
  affected_count INTEGER,
  data_categories TEXT[] NOT NULL DEFAULT '{}',
  affected_user_ids TEXT[] NOT NULL DEFAULT '{}',
  investigation TEXT,
  containment TEXT,
  board_notice_at TIMESTAMPTZ,
  board_detailed_at TIMESTAMPTZ,
  affected_notice_at TIMESTAMPTZ,
  resolution TEXT,
  created_by_id TEXT NOT NULL,
  updated_by_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT privacy_breach_affected_nonnegative CHECK (affected_count IS NULL OR affected_count >= 0)
);
CREATE INDEX privacy_breach_status_discovered_idx ON privacy.privacy_breach_incidents(status, discovered_at);

INSERT INTO privacy.privacy_purposes(key, name, description, data_categories, essential) VALUES
 ('account_service', 'Provide the FitNerve service', 'Create and secure your account, authenticate you, and provide requested account features.', ARRAY['account identifiers','authentication metadata'], true),
 ('fitness_features', 'Provide fitness and coaching features', 'Store and display fitness profile, workouts, nutrition, activity, progress, and coaching information that you choose to use.', ARRAY['fitness profile','workout history','nutrition and activity records','progress photos'], true),
 ('appointments_chat', 'Provide coaching appointments and messaging', 'Schedule and manage coach appointments and deliver messages between you and your currently assigned or booked coach.', ARRAY['appointment details','chat messages','coach relationship'], true),
 ('notifications', 'Send service notifications', 'Send in-app and device notifications about appointments, messages, workouts, and account activity.', ARRAY['notification preferences','device registration token'], false),
 ('support', 'Respond to support and privacy requests', 'Receive, investigate, and respond to help requests and privacy-rights requests.', ARRAY['support request contents','privacy request contents'], false);

INSERT INTO privacy.privacy_retention_policies(id, category, purpose, period_days, basis, enabled, requires_approval) VALUES
 ('dpdp-retention-account', 'account_and_fitness_data', 'Provide the service and account history', NULL, 'No legal period configured. Product/legal owner must determine a justified period before automated erasure is enabled.', false, true),
 ('dpdp-retention-security', 'security_and_audit_logs', 'Protect accounts and investigate security events', NULL, 'No legal period configured. Confirm applicable laws and security needs before setting a period.', false, true),
 ('dpdp-retention-exports', 'data_exports', 'Provide user access to their own records', NULL, 'Current export API streams responses and does not create stored export files. Reassess if temporary files are introduced.', false, true);

INSERT INTO privacy.privacy_processors(id, name, service, purposes, data_categories, storage_locations, safeguards, retention_and_delete, contract_status) VALUES
 ('dpdp-processor-google', 'Google', 'OAuth sign-in and optional Google Calendar / Meet integration', ARRAY['appointments_chat','account_service'], ARRAY['account identifiers','calendar connection tokens'], ARRAY['Google-managed locations; precise account region not verified'], 'OAuth scopes are limited to configured scopes; Calendar tokens are encrypted by the backend.', 'Calendar connection can be disconnected in the app; Google-side retention and processor terms require legal/procurement verification.', 'REVIEW_REQUIRED'),
 ('dpdp-processor-firebase', 'Firebase Cloud Messaging', 'Push notification delivery', ARRAY['notifications'], ARRAY['device registration token','notification payload'], ARRAY['Google-managed locations; precise account region not verified'], 'FCM service account credentials remain server-side.', 'Device tokens can be unregistered; provider retention terms require verification.', 'REVIEW_REQUIRED'),
 ('dpdp-processor-storage', 'Configured S3-compatible storage', 'Store uploaded photos and files', ARRAY['fitness_features','appointments_chat','support'], ARRAY['profile photos','progress photos','chat images','content images'], ARRAY['Configured storage provider and bucket region not verified'], 'Time-limited signed media URLs are used where supported.', 'Object deletion is implemented in application media services; confirm lifecycle rules, backup deletion, region and contract.', 'REVIEW_REQUIRED'),
 ('dpdp-processor-email', 'Configured SMTP email provider', 'Account verification and password reset emails', ARRAY['account_service'], ARRAY['email address','verification code'], ARRAY['Provider location not verified'], 'SMTP credentials are server-side secrets; verification codes expire.', 'Provider-specific message retention and contract require verification.', 'REVIEW_REQUIRED'),
 ('dpdp-processor-hosting', 'Application and database hosting provider', 'Host FitNerve API, portals, and PostgreSQL', ARRAY['account_service','fitness_features','appointments_chat','support'], ARRAY['all application data stored in PostgreSQL'], ARRAY['VPS or configured host; confirm production region'], 'TLS termination, container isolation and DB credentials are deployment-dependent.', 'Backup retention and deletion policy require host/operator confirmation.', 'REVIEW_REQUIRED');

INSERT INTO privacy.privacy_notices(id, version, title, body, policy_url, is_current) VALUES
 ('dpdp-notice-2026-11', '2026-11-v1', 'FitNerve Privacy Notice',
  'FitNerve processes account details to create and secure your account; fitness profile and health/activity information to provide fitness features you choose to use; appointment and message details to provide coaching; and device tokens only when you enable push notifications. Your assigned/booked coach can access information needed for coaching and messages. Administrators can access information needed to operate and support FitNerve. We use service providers for hosting, email, push notifications, Google integrations when connected, and file storage. You can access or correct information in the app, request a data copy, request account deletion, manage optional consent where offered, nominate a representative, or submit a privacy grievance in Profile → Privacy & Security. Some information may be retained when required by law or to resolve legal claims. This notice and its purposes are versioned; review the linked policy for the full explanation and contact fitnervesupport@gmail.com for privacy help.',
  'https://fitnerve.vercel.app/privacy-policy', true);
