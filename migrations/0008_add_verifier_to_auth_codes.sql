-- Bind one-time mobile auth codes to the login initiator
ALTER TABLE auth_codes ADD COLUMN verifier TEXT;

-- Backfill existing rows (if any) to keep schema compatible, then enforce not-null in app logic.
UPDATE auth_codes SET verifier = '' WHERE verifier IS NULL;

CREATE INDEX IF NOT EXISTS idx_auth_codes_verifier ON auth_codes(verifier);
