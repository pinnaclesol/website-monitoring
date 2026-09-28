-- Add an optional display `name`, shown in the sidebar/UI instead of the
-- login `username`. Nullable — falls back to `username` wherever it's
-- unset, so no backfill is required for existing non-protected users.

ALTER TABLE "User" ADD COLUMN "name" TEXT;

-- Data fixup: give the existing bootstrap admin account a display name
-- (doesn't touch its username/password/login credentials).
UPDATE "User" SET "name" = 'Super Admin' WHERE "isProtected" = true;
