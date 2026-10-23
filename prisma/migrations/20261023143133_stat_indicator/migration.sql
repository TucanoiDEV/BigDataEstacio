-- CreateTable
CREATE TABLE "StatIndicator" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "indicator" TEXT NOT NULL,
    "periodCode" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "territoryLevel" "TerritoryLevel" NOT NULL,
    "territoryCode" TEXT NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "StatIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatIndicator_indicator_territoryLevel_territoryCode_period_idx" ON "StatIndicator"("indicator", "territoryLevel", "territoryCode", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "StatIndicator_datasetId_indicator_periodCode_territoryLevel_key" ON "StatIndicator"("datasetId", "indicator", "periodCode", "territoryLevel", "territoryCode");

-- AddForeignKey
ALTER TABLE "StatIndicator" ADD CONSTRAINT "StatIndicator_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "StatDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
