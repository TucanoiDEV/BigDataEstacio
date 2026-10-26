-- CreateEnum
CREATE TYPE "ExternalJobSource" AS ENUM ('ADZUNA', 'GREENHOUSE');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ExternalJob" (
    "id" TEXT NOT NULL,
    "source" "ExternalJobSource" NOT NULL,
    "feed" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "snippet" TEXT NOT NULL DEFAULT '',
    "city" TEXT,
    "cityNormalized" TEXT,
    "state" CHAR(2),
    "locationLabel" TEXT NOT NULL,
    "workModel" "WorkModel",
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "url" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "searchText" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ExternalJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalJob_searchText_trgm_idx" ON "ExternalJob" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ExternalJob_active_postedAt_idx" ON "ExternalJob"("active", "postedAt");

-- CreateIndex
CREATE INDEX "ExternalJob_feed_active_idx" ON "ExternalJob"("feed", "active");

-- CreateIndex
CREATE INDEX "ExternalJob_state_cityNormalized_idx" ON "ExternalJob"("state", "cityNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalJob_source_externalId_key" ON "ExternalJob"("source", "externalId");

-- Integridade que o schema do Prisma não expressa (mesmo padrão de "Job").
ALTER TABLE "ExternalJob"
  ADD CONSTRAINT "ExternalJob_salary_range_chk" CHECK ("salaryMin" IS NULL OR "salaryMax" IS NULL OR "salaryMin" <= "salaryMax"),
  ADD CONSTRAINT "ExternalJob_state_chk" CHECK ("state" IS NULL OR "state" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "ExternalJob_url_https_chk" CHECK ("url" ~ '^https://');

-- A empresa criada pelo seed de desenvolvimento é fictícia.
UPDATE "Organization" SET "isDemo" = true WHERE "slug" = 'empresa-demonstracao';
