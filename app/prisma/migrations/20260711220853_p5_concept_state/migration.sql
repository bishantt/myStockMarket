-- CreateTable
CREATE TABLE "concept_state" (
    "concept" TEXT NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 1,
    "due_on" DATE NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_reviewed_at" TIMESTAMP(3),
    "times_seen" INTEGER NOT NULL DEFAULT 0,
    "times_correct" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "concept_state_pkey" PRIMARY KEY ("concept")
);

-- CreateIndex
CREATE INDEX "concept_state_due_on_idx" ON "concept_state"("due_on");
