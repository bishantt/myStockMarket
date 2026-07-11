/*
  Warnings:

  - Changed the type of `exchange` on the `instrument` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "instrument" DROP COLUMN "exchange",
ADD COLUMN     "exchange" TEXT NOT NULL;

-- DropEnum
DROP TYPE "Exchange";
