-- CreateTable
CREATE TABLE "news_item" (
    "id" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "provider" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "tickers" TEXT[],
    "event_type" TEXT,
    "sentiment" DOUBLE PRECISION,
    "extract" JSONB,

    CONSTRAINT "news_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "symbol" TEXT,
    "timing" TEXT,
    "title" TEXT NOT NULL,
    "consensus" DOUBLE PRECISION,
    "prior" DOUBLE PRECISION,
    "importance" TEXT,

    CONSTRAINT "calendar_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "news_item_published_at_idx" ON "news_item"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "news_item_provider_url_key" ON "news_item"("provider", "url");

-- CreateIndex
CREATE INDEX "calendar_event_date_idx" ON "calendar_event"("date");
