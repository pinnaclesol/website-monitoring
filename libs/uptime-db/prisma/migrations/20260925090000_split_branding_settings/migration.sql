-- Split BrandingSettings' overloaded siteName/faviconUrl pair (each used
-- for two unrelated things at once) into two independent pairs: appName/
-- appLogoUrl (in-app sidebar branding) and siteTitle/faviconUrl (browser
-- tab title/icon). Hand-written, not `prisma migrate dev`-generated, so an
-- admin's already-configured name/icon carries over instead of being reset
-- to schema defaults.

-- siteName was the sidebar name; rename it straight across.
ALTER TABLE "BrandingSettings" RENAME COLUMN "siteName" TO "appName";

-- New: a separate browser-tab title. Backfill from the row's actual current
-- appName (not just the schema default) so a customized name carries over.
ALTER TABLE "BrandingSettings" ADD COLUMN "siteTitle" TEXT NOT NULL DEFAULT 'Uptime Monitor';
UPDATE "BrandingSettings" SET "siteTitle" = "appName";

-- faviconUrl used to serve as BOTH the logo and the favicon; it becomes the
-- logo column going forward.
ALTER TABLE "BrandingSettings" RENAME COLUMN "faviconUrl" TO "appLogoUrl";

-- New: a separate favicon, backfilled from the same old value so the
-- browser tab icon doesn't disappear on upgrade.
ALTER TABLE "BrandingSettings" ADD COLUMN "faviconUrl" TEXT;
UPDATE "BrandingSettings" SET "faviconUrl" = "appLogoUrl";
