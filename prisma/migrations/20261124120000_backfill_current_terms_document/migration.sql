-- The original privacy foundation notice predates the terms columns added by
-- 20261114100000_admin_legal_documents. Backfill the current document so the
-- public registration flow is not disabled on databases that already ran both
-- migrations.
UPDATE privacy.privacy_notices
SET
  terms_version = '2026-11-v1',
  terms_title = 'FitNerve Terms and Conditions',
  terms_body = 'By creating a FitNerve account, you agree to provide accurate information, keep your login details secure, and use the service lawfully. You understand that FitNerve provides fitness and coaching features and that guidance is not a substitute for professional medical advice. You may manage your account and request access, correction, or deletion of your personal information through the available privacy controls. These terms and the Privacy Notice may be updated from time to time; the current versions are shown during registration.'
WHERE is_current = true
  AND (terms_version IS NULL OR terms_body IS NULL OR btrim(terms_body) = '');
