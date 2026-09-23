-- Add fixed 3-role RBAC to User (ADMIN/EDITOR/VIEWER). Hand-written (not
-- `prisma migrate dev`-generated): a plain generated migration would default
-- every existing row -- including the already-seeded live admin user -- to
-- the enum's @default(VIEWER), locking the current admin out of their own
-- app. This migration explicitly backfills every existing row to ADMIN
-- instead.

-- 1. Create the Role enum.
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- 2. Add the column with the schema-declared default (VIEWER) for any
--    future inserts that don't specify a role.
ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'VIEWER';

-- 3. Data fixup: every row that exists today predates RBAC and was already
--    trusted as the single admin -- promote all of them to ADMIN so no
--    existing user is locked out.
UPDATE "User" SET "role" = 'ADMIN';
