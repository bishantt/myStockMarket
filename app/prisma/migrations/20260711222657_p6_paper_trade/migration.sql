-- CreateTable
CREATE TABLE "paper_trade" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference_open" DOUBLE PRECISION NOT NULL,
    "fill_price" DOUBLE PRECISION NOT NULL,
    "cost_bps" DOUBLE PRECISION NOT NULL,
    "signal_viewed_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'open',
    "exit_fill_price" DOUBLE PRECISION,
    "closed_at" TIMESTAMP(3),
    "realized_pnl" DOUBLE PRECISION,
    "note" TEXT,

    CONSTRAINT "paper_trade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "paper_trade_status_idx" ON "paper_trade"("status");

-- CreateIndex
CREATE INDEX "paper_trade_opened_at_idx" ON "paper_trade"("opened_at");
