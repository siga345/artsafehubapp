-- Add version type for track audio versions
CREATE TYPE "DemoVersionType" AS ENUM ('DEMO', 'ARRANGEMENT', 'NO_MIX', 'MIXED', 'MASTERED');

ALTER TABLE "Demo"
ADD COLUMN "versionType" "DemoVersionType" NOT NULL DEFAULT 'DEMO';
