-- No-op migration.
--
-- The previous version attempted to ALTER auth_codes, but this repository's
-- migration chain does not create that table. Keep this migration as a no-op
-- to preserve already-applied migration numbering while allowing clean setup.
SELECT 1;
