import "server-only";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { searchJobs } from "@/server/services/search";
import { notify } from "@/server/services/notifications";
import { sendMailSafe } from "@/server/mail/mailer";
import { mail } from "@/server/mail/templates";
import { alertFiltersSchema } from "@/lib/validation/search";

const PERIOD_MS = { DAILY: 24 * 3600_000, WEEKLY: 7 * 24 * 3600_000 } as const;

/**
 * Processa alertas vencidos: busca vagas publicadas desde o último envio,
 * envia notificação interna e e-mail (se o usuário permitir).
 * Executado periodicamente (cron): `npm run jobs:alerts`.
 *
 * O cursor (`lastSentAt`) só avança depois da notificação interna: se ela falhar,
 * a mesma janela é reprocessada na próxima execução em vez de ser perdida.
 * `sent` conta alertas notificados; e-mails entregues e falhos são contados à parte.
 */
export async function runJobAlerts(now = new Date()) {
  const alerts = await db.jobAlert.findMany({
    where: { active: true, user: { status: "ACTIVE", emailVerifiedAt: { not: null } } },
    include: { user: { select: { id: true, email: true, commPreference: { select: { emailJobAlerts: true } } } } },
  });
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let emailed = 0;
  let emailFailed = 0;
  for (const alert of alerts) {
    const last = alert.lastSentAt ?? alert.createdAt;
    if (now.getTime() - last.getTime() < PERIOD_MS[alert.frequency]) {
      skipped++;
      continue;
    }
    const parsed = alertFiltersSchema.safeParse(alert.filters);
    if (!parsed.success) {
      skipped++;
      continue;
    }
    try {
      const result = await searchJobs({ ...parsed.data, ordem: "recent", pagina: 1 }, 10, { publishedAfter: last });
      if (result.jobs.length > 0) {
        const base = env().APP_URL;
        await notify({
          userId: alert.user.id,
          type: "JOB_ALERT",
          title: `${result.total} nova(s) vaga(s): ${alert.name}`,
          body: result.jobs.slice(0, 3).map((j) => j.title).join(" · "),
          link: "/minha-conta/alertas",
        });
        if (alert.user.commPreference?.emailJobAlerts ?? true) {
          const ok = await sendMailSafe(
            mail.jobAlert(
              alert.user.email,
              alert.name,
              result.jobs.map((j) => ({ title: j.title, org: j.org.tradeName, url: new URL(`/vagas/${j.id}`, base).toString() })),
              new URL("/minha-conta/alertas", base).toString(),
            ),
          );
          if (ok) emailed++;
          else emailFailed++;
        }
        sent++;
      }
      // Marca a janela como processada mesmo sem vagas novas (evita reprocessar o mesmo intervalo).
      await db.jobAlert.update({ where: { id: alert.id }, data: { lastSentAt: now } });
    } catch (err) {
      failed++;
      console.error("[alerts] falha ao processar alerta", alert.id, err instanceof Error ? err.message : err);
    }
  }
  return { processed: alerts.length, sent, skipped, failed, emailed, emailFailed };
}

/** Limpeza periódica de dados expirados (minimização). */
export async function runMaintenance(now = new Date()) {
  const [sessions, tokens, buckets, invites] = await Promise.all([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.verificationToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }], createdAt: { lt: new Date(now.getTime() - 24 * 3600_000) } } }),
    db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.orgInvitation.deleteMany({ where: { acceptedAt: null, expiresAt: { lt: new Date(now.getTime() - 30 * 24 * 3600_000) } } }),
  ]);
  return { sessions: sessions.count, tokens: tokens.count, rateLimitBuckets: buckets.count, invitations: invites.count };
}
