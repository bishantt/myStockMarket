-- CreateTable
CREATE TABLE "market_context" (
    "run_date" DATE NOT NULL,
    "vix" DOUBLE PRECISION,
    "ten_year" DOUBLE PRECISION,
    "advancers" INTEGER NOT NULL,
    "decliners" INTEGER NOT NULL,
    "pct_above_50dma" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "market_context_pkey" PRIMARY KEY ("run_date")
);
