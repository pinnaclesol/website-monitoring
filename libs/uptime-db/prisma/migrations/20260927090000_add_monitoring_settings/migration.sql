-- New table: the global monitor check interval (previously a hardcoded
-- 60s constant in apps/api/src/monitors/monitors.service.ts) becomes a
-- configurable setting. No data migration needed -- the schema default
-- (60s) matches the previous hardcoded behavior exactly.

CREATE TABLE "MonitoringSettings" (
    "id" TEXT NOT NULL,
    "checkIntervalSeconds" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringSettings_pkey" PRIMARY KEY ("id")
);
