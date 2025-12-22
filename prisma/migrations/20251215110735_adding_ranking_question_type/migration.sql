-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "allow_partial_rank" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "max_rank_allowed" INTEGER,
ADD COLUMN     "min_rank_required" INTEGER;

-- CreateTable
CREATE TABLE "RankingResponseAnswer" (
    "id" TEXT NOT NULL,
    "responseAnswerId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "rank_position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingResponseAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RankingResponseAnswer_responseAnswerId_rank_position_idx" ON "RankingResponseAnswer"("responseAnswerId", "rank_position");

-- CreateIndex
CREATE INDEX "RankingResponseAnswer_responseAnswerId_idx" ON "RankingResponseAnswer"("responseAnswerId");

-- CreateIndex
CREATE UNIQUE INDEX "RankingResponseAnswer_responseAnswerId_optionId_key" ON "RankingResponseAnswer"("responseAnswerId", "optionId");

-- AddForeignKey
ALTER TABLE "RankingResponseAnswer" ADD CONSTRAINT "RankingResponseAnswer_responseAnswerId_fkey" FOREIGN KEY ("responseAnswerId") REFERENCES "ResponseAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingResponseAnswer" ADD CONSTRAINT "RankingResponseAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
