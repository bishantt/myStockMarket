-- CreateTable
CREATE TABLE "pipeline_run" (
    "run_date" DATE NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "stage_status" JSONB NOT NULL,
    "source_status" JSONB NOT NULL,
    "batch_id" TEXT,

    CONSTRAINT "pipeline_run_pkey" PRIMARY KEY ("run_date")
);
