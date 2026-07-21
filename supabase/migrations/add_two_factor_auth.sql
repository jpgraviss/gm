-- AUDIT.md #207 — real email-based 2FA for staff sign-in when Security
-- Settings' "Two-Factor Auth" is set to Required. Mirrors the existing
-- verification_code/verification_expires pattern already used for
-- onboarding (add_verification_codes.sql) rather than a new mechanism.
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS two_factor_code text,
  ADD COLUMN IF NOT EXISTS two_factor_code_expires timestamptz;
