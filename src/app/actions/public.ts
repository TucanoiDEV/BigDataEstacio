"use server";

import { z } from "zod";
import { createAction } from "@/server/action";
import { assertUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { notFound } from "@/server/errors";
import { enforceRateLimits } from "@/server/security/rate-limit";
import { getRequestContext } from "@/server/security/request";
import { sendMail } from "@/server/mail/mailer";
import { notifyMany, platformAdminIds } from "@/server/services/notifications";
import { idSchema, text } from "@/lib/validation/common";
import { contactSchema } from "@/lib/validation/privacy";

export const reportJobAction = createAction(
  z.object({
    jobId: idSchema,
    reason: z.enum(["SCAM", "PAYMENT_REQUEST", "MISLEADING", "DISCRIMINATORY", "DUPLICATE", "OTHER"]),
    details: text(10, 2000, "Detalhes"),
  }),
  async (input) => {
    const user = await assertUser({ allowUnverified: true });
    await enforceRateLimits([{ key: `report:user:${user.id}`, limit: 10, windowSeconds: 86400 }]);
    const job = await db.job.findUnique({ where: { id: input.jobId }, select: { id: true, orgId: true, title: true } });
    if (!job) throw notFound();
    const report = await db.report.create({
      data: { reporterUserId: user.id, jobId: job.id, orgId: job.orgId, reason: input.reason, details: input.details },
      select: { id: true },
    });
    await audit({ actorUserId: user.id, action: "report.created", targetType: "Report", targetId: report.id, orgId: job.orgId, metadata: { reason: input.reason } });
    await notifyMany(await platformAdminIds(), { type: "JOB_MODERATION", title: "Nova denúncia", body: `Vaga "${job.title}"`, link: "/admin/denuncias" });
    return { ok: true, message: "Denúncia enviada. Obrigado por ajudar a manter a plataforma segura." };
  },
);

export const contactAction = createAction(contactSchema, async (input) => {
  const ctx = await getRequestContext();
  await enforceRateLimits([{ key: `contact:ip:${ctx.ipHash}`, limit: 5, windowSeconds: 3600 }]);
  const inbox = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  if (!inbox) {
    return { ok: false, error: "O canal de contato ainda não foi configurado pelo operador da plataforma." };
  }
  await sendMail({
    to: inbox,
    subject: `[Contato:${input.subject}] ${input.name}`,
    text: `De: ${input.name} <${input.email}>\nAssunto: ${input.subject}\n\n${input.message}`,
    html: `<p>De: ${escape(input.name)} &lt;${escape(input.email)}&gt;</p><p>Assunto: ${input.subject}</p><pre style="white-space:pre-wrap">${escape(input.message)}</pre>`,
  });
  return { ok: true, message: "Mensagem enviada. Responderemos pelo e-mail informado." };
});

function escape(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
