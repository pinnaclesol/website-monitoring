-- Rename tables to self-descriptive names (a dev browsing the table list
-- shouldn't have to cross-reference the schema to know what each one is
-- for). Written as RENAME statements, not drop+recreate, so existing data
-- survives. Hand-written (not `prisma migrate dev`-generated): Prisma's
-- schema diff can't infer a rename from a plain model-name change and
-- would otherwise propose dropping and recreating every one of these
-- tables.

-- Site -> Monitor: matches the app's own UI language ("Add monitor").
ALTER TABLE "Site" RENAME TO "Monitor";
-- Check -> MonitorCheck: "Check" alone says nothing about what it's a check of.
ALTER TABLE "Check" RENAME TO "MonitorCheck";
-- AlertState -> MonitorAlertState: disconnected from "Monitor" otherwise.
ALTER TABLE "AlertState" RENAME TO "MonitorAlertState";
-- NotificationSettings -> AlertSettings: it's specifically alert-repeat/recovery behavior.
ALTER TABLE "NotificationSettings" RENAME TO "AlertSettings";
-- AppSettings -> BrandingSettings: it's specifically site name + favicon, matches /settings/branding.
ALTER TABLE "AppSettings" RENAME TO "BrandingSettings";

-- Rename the foreign key columns to match.
ALTER TABLE "MonitorCheck" RENAME COLUMN "siteId" TO "monitorId";
ALTER TABLE "Incident" RENAME COLUMN "siteId" TO "monitorId";
ALTER TABLE "MonitorAlertState" RENAME COLUMN "siteId" TO "monitorId";

-- Rename primary key constraints to match their table's new name.
ALTER TABLE "Monitor" RENAME CONSTRAINT "Site_pkey" TO "Monitor_pkey";
ALTER TABLE "MonitorCheck" RENAME CONSTRAINT "Check_pkey" TO "MonitorCheck_pkey";
ALTER TABLE "MonitorAlertState" RENAME CONSTRAINT "AlertState_pkey" TO "MonitorAlertState_pkey";
ALTER TABLE "AlertSettings" RENAME CONSTRAINT "NotificationSettings_pkey" TO "AlertSettings_pkey";
ALTER TABLE "BrandingSettings" RENAME CONSTRAINT "AppSettings_pkey" TO "BrandingSettings_pkey";

-- Rename foreign key constraints to match the renamed column.
ALTER TABLE "MonitorCheck" RENAME CONSTRAINT "Check_siteId_fkey" TO "MonitorCheck_monitorId_fkey";
ALTER TABLE "Incident" RENAME CONSTRAINT "Incident_siteId_fkey" TO "Incident_monitorId_fkey";
ALTER TABLE "MonitorAlertState" RENAME CONSTRAINT "AlertState_siteId_fkey" TO "MonitorAlertState_monitorId_fkey";

-- Rename indexes (table rename does not rename its indexes in Postgres).
ALTER INDEX "AlertState_siteId_key" RENAME TO "MonitorAlertState_monitorId_key";
ALTER INDEX "Check_siteId_timestamp_idx" RENAME TO "MonitorCheck_monitorId_timestamp_idx";
ALTER INDEX "Incident_siteId_startedAt_idx" RENAME TO "Incident_monitorId_startedAt_idx";
