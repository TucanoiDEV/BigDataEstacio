"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction } from "@/server/action";
import { assertPlatformAdmin } from "@/server/auth/dal";
import * as admin from "@/server/services/admin";
import { idSchema, optionalText, text } from "@/lib/validation/common";

const notes = optionalText(1000, "Observações");

export const decideOrgAction = createAction(
  z.object({ orgId: idSchema, decision: z.enum(["verify", "reject", "suspend", "reinstate"]), notes }),
  async ({ orgId, decision, notes }) => {
    const user = await assertPlatformAdmin();
    await admin.decideOrganization(user, orgId, decision, notes);
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Decisão registrada." };
  },
);

export const moderateJobAction = createAction(
  z.object({ jobId: idSchema, decision: z.enum(["approve", "remove"]), notes }),
  async ({ jobId, decision, notes }) => {
    const user = await assertPlatformAdmin();
    await admin.moderateJob(user, jobId, decision, notes);
    revalidatePath("/admin", "layout");
    return { ok: true, message: decision === "approve" ? "Vaga aprovada." : "Vaga removida." };
  },
);

export const resolveReportAction = createAction(
  z.object({ reportId: idSchema, status: z.enum(["REVIEWING", "RESOLVED", "DISMISSED"]), resolution: notes }),
  async ({ reportId, status, resolution }) => {
    const user = await assertPlatformAdmin();
    await admin.resolveReport(user, reportId, status, resolution);
    revalidatePath("/admin/denuncias");
    return { ok: true, message: "Denúncia atualizada." };
  },
);

export const setUserStatusAction = createAction(z.object({ userId: idSchema, status: z.enum(["ACTIVE", "SUSPENDED"]) }), async ({ userId, status }) => {
  const user = await assertPlatformAdmin();
  await admin.setUserStatus(user, userId, status);
  revalidatePath("/admin/usuarios");
  return { ok: true, message: status === "SUSPENDED" ? "Conta suspensa e sessões encerradas." : "Conta reativada." };
});

export const revokeUserSessionsAction = createAction(z.object({ userId: idSchema }), async ({ userId }) => {
  const user = await assertPlatformAdmin();
  await admin.revokeUserSessions(user, userId);
  return { ok: true, message: "Sessões encerradas." };
});

export const updatePrivacyRequestAction = createAction(
  z.object({ id: idSchema, status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "REJECTED"]), response: optionalText(3000, "Resposta") }),
  async ({ id, status, response }) => {
    const user = await assertPlatformAdmin();
    await admin.updatePrivacyRequest(user, id, status, response);
    revalidatePath("/admin/privacidade");
    return { ok: true, message: "Solicitação atualizada." };
  },
);

const dateOrNull = z
  .string()
  .nullish()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Data inválida.");

export const saveIncidentAction = createAction(
  z.object({
    id: idSchema.optional(),
    title: text(5, 200, "Título"),
    description: text(10, 5000, "Descrição"),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"], { error: "Escolha a gravidade." }),
    status: z.enum(["OPEN", "CONTAINED", "RESOLVED"], { error: "Escolha o status." }),
    detectedAt: z.string().min(1, "Informe quando foi detectado.").transform((v) => new Date(v)),
    personalDataAffected: z.boolean(),
    dataCategories: z.string().default("").transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20)),
    estimatedSubjects: z.number().int().min(0).nullish().transform((v) => v ?? null),
    riskAssessment: optionalText(3000, "Avaliação de risco"),
    anpdNotificationRequired: z.enum(["yes", "no", "undetermined"], { error: "Indique se a ANPD deve ser notificada." }).transform((v) => (v === "yes" ? true : v === "no" ? false : null)),
    anpdNotifiedAt: dateOrNull,
    subjectsNotifiedAt: dateOrNull,
    actionsTaken: optionalText(5000, "Medidas adotadas"),
  }),
  async (input) => {
    const user = await assertPlatformAdmin();
    await admin.saveIncident(user, input);
    revalidatePath("/admin/incidentes");
    return { ok: true, message: "Incidente registrado." };
  },
);

export const setDatasetStatusAction = createAction(z.object({ datasetId: idSchema, status: z.enum(["PUBLISHED", "ARCHIVED"]) }), async ({ datasetId, status }) => {
  const user = await assertPlatformAdmin();
  await admin.setDatasetStatus(user, datasetId, status);
  revalidatePath("/admin/dados");
  revalidatePath("/mercado-de-trabalho");
  return { ok: true, message: status === "PUBLISHED" ? "Conjunto publicado no observatório." : "Conjunto arquivado." };
});
