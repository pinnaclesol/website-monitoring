-- AlterTable
ALTER TABLE "MonitorCheck" ADD COLUMN     "errorType" TEXT,
ADD COLUMN     "finalUrl" TEXT,
ADD COLUMN     "redirectCount" INTEGER;

-- AlterTable
ALTER TABLE "MonitoringSettings" ADD COLUMN     "retryAttempts" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "retryDelaySeconds" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "slowThresholdMs" INTEGER NOT NULL DEFAULT 2000,
ADD COLUMN     "timeoutSeconds" INTEGER NOT NULL DEFAULT 10;
