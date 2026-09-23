-- Add an `isProtected` flag marking the one bootstrap admin account as
-- immutable through the Users CRUD API (can't be edited or deleted by
-- anyone, including itself) -- a guaranteed way back in via
-- `npm run uptime:seed` even if every other admin is locked out or removed.

-- 1. Add the column, defaulting future inserts (users created from the
--    `/users` view) to unprotected.
ALTER TABLE "User" ADD COLUMN "isProtected" BOOLEAN NOT NULL DEFAULT false;

-- 2. Data fixup: protect exactly the earliest-created row -- the original
--    env-seeded admin -- not every row, in case more than one already
--    exists by the time this runs.
UPDATE "User" SET "isProtected" = true
WHERE id = (SELECT id FROM "User" ORDER BY "createdAt" ASC LIMIT 1);
