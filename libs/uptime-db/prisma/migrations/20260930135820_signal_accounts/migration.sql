/*
  Warnings:

  - You are about to drop the `SignalConfig` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "SignalConfig";

-- CreateTable
CREATE TABLE "signal_accounts" (
    "id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signal_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_groups" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT,
    "account_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "receive_alerts" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signal_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "signal_accounts_phone_number_key" ON "signal_accounts"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "signal_groups_account_id_group_id_key" ON "signal_groups"("account_id", "group_id");

-- AddForeignKey
ALTER TABLE "signal_groups" ADD CONSTRAINT "signal_groups_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "signal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
