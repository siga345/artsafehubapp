ALTER TABLE "DailyMicroStep"
ADD COLUMN "stepPool" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "stepCursor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "completedStepIndexes" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

UPDATE "DailyMicroStep"
SET
  "stepPool" = ARRAY["text"]::TEXT[],
  "stepCursor" = 0,
  "completedStepIndexes" = CASE
    WHEN "isCompleted" THEN ARRAY[0]::INTEGER[]
    ELSE ARRAY[]::INTEGER[]
  END
WHERE cardinality("stepPool") = 0;
