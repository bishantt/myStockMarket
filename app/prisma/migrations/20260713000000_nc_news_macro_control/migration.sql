-- News & Control plan (Appendix C): macro_stat, the news trio, manual_run, and two column
-- extensions. Landed whole at N0 so the seed has tables to write into; the CODE that fills
-- them arrives with its phase (N3 macro, N4 news, N6 manual runs).

-- AlterTable
ALTER TABLE "market_context" ADD COLUMN     "index_levels_as_of" DATE;

-- AlterTable
ALTER TABLE "news_item" ADD COLUMN     "category" TEXT,
ADD COLUMN     "cluster_id" TEXT,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "industries" TEXT[],
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "macro_stat" (
    "series_key" TEXT NOT NULL,
    "as_of_date" DATE NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "prior" DOUBLE PRECISION,
    "as_of_label" TEXT NOT NULL,
    "source_key" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "meta" JSONB,

    CONSTRAINT "macro_stat_pkey" PRIMARY KEY ("series_key","as_of_date")
);

-- CreateTable
CREATE TABLE "news_cluster" (
    "id" TEXT NOT NULL,
    "run_date" DATE NOT NULL,
    "first_seen" TIMESTAMP(3) NOT NULL,
    "headline" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "sectors" TEXT[],
    "themes" TEXT[],
    "tickers" TEXT[],
    "significance" DOUBLE PRECISION NOT NULL,
    "sources" INTEGER NOT NULL,
    "why_it_matters" TEXT,
    "affected_note" TEXT,
    "extract" JSONB NOT NULL,
    "verification" JSONB NOT NULL,
    "image_id" TEXT,

    CONSTRAINT "news_cluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalyst_link" (
    "id" TEXT NOT NULL,
    "cluster_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "ret1" DOUBLE PRECISION,
    "rvol20" DOUBLE PRECISION,
    "has_setup_card" BOOLEAN NOT NULL,

    CONSTRAINT "catalyst_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_image" (
    "id" TEXT NOT NULL,
    "source_kind" TEXT NOT NULL,
    "url_full" TEXT NOT NULL,
    "url_card" TEXT NOT NULL,
    "url_thumb" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "blur_data_url" TEXT NOT NULL,
    "dominant_color" TEXT NOT NULL,
    "attribution_source" TEXT NOT NULL,
    "attribution_url" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_run" (
    "id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflow" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "gh_run_id" BIGINT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "manual_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "macro_stat_series_key_as_of_date_idx" ON "macro_stat"("series_key", "as_of_date" DESC);

-- CreateIndex
CREATE INDEX "news_cluster_run_date_significance_idx" ON "news_cluster"("run_date", "significance" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "catalyst_link_cluster_id_symbol_key" ON "catalyst_link"("cluster_id", "symbol");

-- CreateIndex
CREATE INDEX "manual_run_requested_at_idx" ON "manual_run"("requested_at" DESC);

-- CreateIndex
CREATE INDEX "news_item_cluster_id_idx" ON "news_item"("cluster_id");

-- AddForeignKey
ALTER TABLE "news_cluster" ADD CONSTRAINT "news_cluster_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "news_image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalyst_link" ADD CONSTRAINT "catalyst_link_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "news_cluster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

