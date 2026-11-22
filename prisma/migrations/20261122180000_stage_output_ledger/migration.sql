-- CreateTable
CREATE TABLE "StageOutput" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "good" INTEGER NOT NULL DEFAULT 0,
    "scrap" INTEGER NOT NULL DEFAULT 0,
    "rejectionReasonId" INTEGER,
    "source" TEXT NOT NULL,
    "activityId" INTEGER,
    "userId" INTEGER,
    "userName" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageOutput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StageOutput_workOrderId_seq_idx" ON "StageOutput"("workOrderId", "seq");

-- CreateIndex
CREATE INDEX "StageOutput_date_idx" ON "StageOutput"("date");

-- CreateIndex
CREATE INDEX "StageOutput_activityId_idx" ON "StageOutput"("activityId");

-- AddForeignKey
ALTER TABLE "StageOutput" ADD CONSTRAINT "StageOutput_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageOutput" ADD CONSTRAINT "StageOutput_rejectionReasonId_fkey" FOREIGN KEY ("rejectionReasonId") REFERENCES "RejectionReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageOutput" ADD CONSTRAINT "StageOutput_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: the orders already on the floor moved whole, so every stage
-- before the current one finished the whole quantity; a completed order
-- finished every stage. Cancelled and not-released orders have no pieces yet.
INSERT INTO "StageOutput" ("workOrderId", "seq", "date", "good", "scrap", "source", "userName")
SELECT w."id", s."seq", COALESCE(w."completedAt", w."startedAt", w."woDate")::date, w."qty", 0, 'backfill', 'System'
FROM "WorkOrder" w
JOIN "WorkOrderStage" s ON s."workOrderId" = w."id"
WHERE w."status" <> 'CANCELLED'
  AND (w."status" = 'COMPLETED' OR (w."stageIndex" IS NOT NULL AND s."seq" < w."stageIndex"));
