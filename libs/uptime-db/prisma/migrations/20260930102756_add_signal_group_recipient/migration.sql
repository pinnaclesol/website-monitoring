-- AlterTable
ALTER TABLE "SignalConfig" ADD COLUMN     "recipientGroupId" TEXT,
ADD COLUMN     "recipientGroupName" TEXT,
ALTER COLUMN "recipientNumber" DROP NOT NULL;
