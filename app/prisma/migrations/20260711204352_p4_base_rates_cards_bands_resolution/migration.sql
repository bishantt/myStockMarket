-- CreateTable
CREATE TABLE "base_rate_stat" (
    "id" TEXT NOT NULL,
    "pattern_key" TEXT NOT NULL,
    "universe" TEXT NOT NULL,
    "horizon_days" INTEGER NOT NULL,
    "regime" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "win_rate" DOUBLE PRECISION NOT NULL,
    "ci_low" DOUBLE PRECISION NOT NULL,
    "ci_high" DOUBLE PRECISION NOT NULL,
    "fwd_p10" DOUBLE PRECISION,
    "fwd_median" DOUBLE PRECISION,
    "fwd_p90" DOUBLE PRECISION,
    "baseline_up_rate" DOUBLE PRECISION,
    "publication_year" INTEGER,
    "evidence_grade" TEXT NOT NULL,
    "decay_note" TEXT,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "base_rate_stat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setup_card" (
    "id" TEXT NOT NULL,
    "run_date" DATE NOT NULL,
    "symbol" TEXT NOT NULL,
    "pattern_key" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "weakeners" JSONB NOT NULL,
    "base_rate_id" TEXT,

    CONSTRAINT "setup_card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vol_band" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "run_date" DATE NOT NULL,
    "horizon_days" INTEGER NOT NULL,
    "lo" DOUBLE PRECISION NOT NULL,
    "hi" DOUBLE PRECISION NOT NULL,
    "coverage" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "vol_band_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_resolution" (
    "id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signal_resolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "base_rate_stat_pattern_key_universe_horizon_days_regime_key" ON "base_rate_stat"("pattern_key", "universe", "horizon_days", "regime");

-- CreateIndex
CREATE INDEX "setup_card_run_date_idx" ON "setup_card"("run_date");

-- CreateIndex
CREATE INDEX "vol_band_run_date_idx" ON "vol_band"("run_date");

-- CreateIndex
CREATE UNIQUE INDEX "signal_resolution_signal_id_key" ON "signal_resolution"("signal_id");

-- AddForeignKey
ALTER TABLE "setup_card" ADD CONSTRAINT "setup_card_base_rate_id_fkey" FOREIGN KEY ("base_rate_id") REFERENCES "base_rate_stat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal_resolution" ADD CONSTRAINT "signal_resolution_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signal_log"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- signal_resolution is INSERT-ONLY (plan §1.5 rule 7), exactly like signal_log: the resolved
-- track record — including the app's own misses — can never be rewritten. The REVOKE is not enough
-- because the app connects as the table owner on Supabase, so a BEFORE UPDATE OR DELETE trigger
-- raises for everyone, owner included.
CREATE OR REPLACE FUNCTION signal_resolution_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'signal_resolution is insert-only (plan rule 7): % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER signal_resolution_no_update_delete
  BEFORE UPDATE OR DELETE ON "signal_resolution"
  FOR EACH ROW EXECUTE FUNCTION signal_resolution_block_mutation();
