-- CreateTable
CREATE TABLE "briefing" (
    "run_date" DATE NOT NULL,
    "am_json" JSONB NOT NULL,
    "pm_json" JSONB,
    "verification_json" JSONB NOT NULL,
    "model_meta" JSONB NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "briefing_pkey" PRIMARY KEY ("run_date")
);

-- CreateTable
CREATE TABLE "journal_entry" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "prompt" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "forecast" TEXT,
    "probability" DOUBLE PRECISION,
    "resolves_on" DATE,
    "outcome" TEXT,
    "brier" DOUBLE PRECISION,

    CONSTRAINT "journal_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "journal_entry_date_idx" ON "journal_entry"("date");
