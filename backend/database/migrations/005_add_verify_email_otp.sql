ALTER TABLE email_otps DROP CONSTRAINT IF EXISTS email_otps_purpose_check;

ALTER TABLE email_otps
  ADD CONSTRAINT email_otps_purpose_check
  CHECK (purpose IN ('VERIFY_EMAIL', 'RESET_PASSWORD', 'CHANGE_PASSWORD'));