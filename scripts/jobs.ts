// Tarefas agendadas (cron). Uso:
//   npm run jobs:alerts       -> envia alertas de vagas
//   npm run jobs:maintenance  -> remove sessões/tokens/limites expirados
//   npm run jobs:external     -> importa vagas externas (Adzuna, Greenhouse)
import "dotenv/config";
import { runJobAlerts, runMaintenance } from "@/server/services/alerts-job";
import { runExternalJobsImport } from "@/server/services/external-jobs";
import { db } from "@/server/db";

async function main() {
  const task = process.argv[2];
  if (task === "alerts") console.log("[jobs] alertas:", await runJobAlerts());
  else if (task === "maintenance") console.log("[jobs] manutenção:", await runMaintenance());
  else if (task === "external") console.log("[jobs] vagas externas:", JSON.stringify(await runExternalJobsImport(), null, 2));
  else {
    console.error("Uso: tsx scripts/jobs.ts <alerts|maintenance|external>");
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
