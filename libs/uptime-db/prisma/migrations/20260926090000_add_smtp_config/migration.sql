-- New table: the SMTP relay config moves from env vars (SMTP_HOST/PORT/
-- USER/PASS/FROM) to the Settings view. No data migration needed — nothing
-- in the codebase reads those env vars today (alert dispatch is still a
-- stub, see apps/worker/src/alerts/alerts.service.ts), so there's no
-- existing working config to preserve.

CREATE TABLE "SmtpConfig" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "username" TEXT,
    "password" TEXT,
    "fromEmail" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmtpConfig_pkey" PRIMARY KEY ("id")
);
