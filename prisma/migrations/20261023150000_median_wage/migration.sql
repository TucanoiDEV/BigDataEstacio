-- O pipeline publica a MEDIANA do salário de admissão (robusta a valores extremos
-- presentes nos microdados), não a média. O nome da coluna reflete isso.
ALTER TABLE "StatEmploymentFlow" RENAME COLUMN "avgAdmissionWage" TO "medianAdmissionWage";
ALTER TABLE "StatEmploymentFlow" RENAME CONSTRAINT "StatEmploymentFlow_wage_chk" TO "StatEmploymentFlow_median_wage_chk";
