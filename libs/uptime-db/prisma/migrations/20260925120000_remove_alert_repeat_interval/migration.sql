-- Removes the repeat-reminder-while-down interval: alerts now fire exactly
-- once per down period (down-confirmed) and once on recovery, never a
-- repeating nag while still down. No data to preserve -- this was purely a
-- gating interval, not user content.

ALTER TABLE "AlertSettings" DROP COLUMN "alertIntervalSeconds";
