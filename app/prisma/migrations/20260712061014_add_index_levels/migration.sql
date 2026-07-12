-- AlterTable
ALTER TABLE "calendar_event" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "market_context" ADD COLUMN     "djia" DOUBLE PRECISION,
ADD COLUMN     "djia_prior" DOUBLE PRECISION,
ADD COLUMN     "nasdaq_composite" DOUBLE PRECISION,
ADD COLUMN     "nasdaq_composite_prior" DOUBLE PRECISION,
ADD COLUMN     "sp500" DOUBLE PRECISION,
ADD COLUMN     "sp500_prior" DOUBLE PRECISION;
