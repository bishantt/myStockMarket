-- CreateEnum
CREATE TYPE "Exchange" AS ENUM ('NYSE', 'NASDAQ', 'AMEX');

-- CreateTable
CREATE TABLE "instrument" (
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exchange" "Exchange" NOT NULL,
    "sector" TEXT,
    "industry" TEXT,
    "cik" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "delisted_at" DATE,

    CONSTRAINT "instrument_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "price_bar" (
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "adj_close" DOUBLE PRECISION NOT NULL,
    "vol" BIGINT NOT NULL,

    CONSTRAINT "price_bar_pkey" PRIMARY KEY ("symbol","date")
);

-- CreateTable
CREATE TABLE "watchlist_item" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "is_focus" BOOLEAN NOT NULL DEFAULT false,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_result" (
    "id" TEXT NOT NULL,
    "run_date" DATE NOT NULL,
    "preset_key" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "metrics" JSONB NOT NULL,

    CONSTRAINT "scan_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_log" (
    "id" TEXT NOT NULL,
    "fired_date" DATE NOT NULL,
    "symbol" TEXT NOT NULL,
    "pattern_key" TEXT NOT NULL,
    "horizon_days" INTEGER NOT NULL,
    "stated_win_rate" DOUBLE PRECISION,
    "stated_n" INTEGER,
    "resolves_on" DATE NOT NULL,

    CONSTRAINT "signal_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "watchlist_item_symbol_idx" ON "watchlist_item"("symbol");

-- CreateIndex
CREATE INDEX "scan_result_run_date_idx" ON "scan_result"("run_date");

-- CreateIndex
CREATE UNIQUE INDEX "signal_log_fired_date_pattern_key_symbol_horizon_days_key" ON "signal_log"("fired_date", "pattern_key", "symbol", "horizon_days");

-- AddForeignKey
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "instrument"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;
