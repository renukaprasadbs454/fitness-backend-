ALTER TABLE privacy.privacy_notices
  ADD COLUMN terms_version TEXT,
  ADD COLUMN terms_title TEXT,
  ADD COLUMN terms_body TEXT;

ALTER TABLE privacy.privacy_notice_acknowledgements
  ADD COLUMN privacy_policy_accepted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN terms_accepted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN terms_version TEXT;
