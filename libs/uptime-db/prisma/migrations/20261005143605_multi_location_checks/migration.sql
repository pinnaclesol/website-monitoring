-- AlterTable
ALTER TABLE "MonitoringSettings" ADD COLUMN     "locations" TEXT[] DEFAULT ARRAY['US', 'DE', 'SG']::TEXT[];

-- CreateTable
CREATE TABLE "MonitorCheckRegion" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "isUp" BOOLEAN NOT NULL,
    "inconclusive" BOOLEAN NOT NULL DEFAULT false,
    "statusCode" INTEGER,
    "responseTimeMs" INTEGER,
    "error" TEXT,
    "errorType" TEXT,
    "finalUrl" TEXT,
    "redirectCount" INTEGER,

    CONSTRAINT "MonitorCheckRegion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonitorCheckRegion_checkId_idx" ON "MonitorCheckRegion"("checkId");

-- AddForeignKey
ALTER TABLE "MonitorCheckRegion" ADD CONSTRAINT "MonitorCheckRegion_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "MonitorCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
