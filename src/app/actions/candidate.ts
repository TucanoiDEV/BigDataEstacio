"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, runAction } from "@/server/action";
import { assertUser } from "@/server/auth/dal";
import { clearSessionCookie } from "@/server/auth/session";
import { getRequestContext } from "@/server/security/request";
import { invalid } from "@/server/errors";
import * as profile from "@/server/services/profile";
import * as applications from "@/server/services/applications";
import * as saved from "@/server/services/saved-and-alerts";
import * as privacy from "@/server/services/privacy";
import { markAllRead } from "@/server/services/notifications";
import { db } from "@/server/db";
import { idSchema, optionalText } from "@/lib/validation/common";
import { educationSchema, experienceSchema, privacySettingsSchema, profileSchema } from "@/lib/validation/profile";
import { deleteAccountSchema, privacyRequestSchema } from "@/lib/validation/privacy";
import { alertFiltersSchema } from "@/lib/validation/search";

// ---------------------------------------------------------------------------
// Vagas salvas e candidaturas
// ---------------------------------------------------------------------------

export const toggleSavedJobAction = createAction(z.object({ jobId: idSchema }), async ({ jobId }) => {
  const user = await assertUser({ allowUnverified: true });
  const isSaved = await saved.toggleSavedJob(user.id, jobId);
  revalidatePath("/minha-conta/favoritas");
  return { ok: true, data: { saved: isSaved } };
});

export const applyAction = createAction(
  z.object({
    jobId: idSchema,
    resumeId: idSchema.nullish().transform((v) => v ?? null),
    coverLetter: optionalText(3000, "Mensagem"),
    shareEmail: z.boolean(),
    sharePhone: z.boolean(),
    confirm: z.literal(true, { error: "Confirme o compartilhamento dos dados com a empresa." }),
  }),
  async (input) => {
    const user = await assertUser();
    await profile.ensureProfile(user.id);
    const id = await applications.applyToJob(user, input);
    redirect(`/minha-conta/candidaturas/${id}?enviada=1`);
  },
);

export const withdrawApplicationAction = createAction(z.object({ applicationId: idSchema }), async ({ applicationId }) => {
  const user = await assertUser();
  await applications.withdrawApplication(user, applicationId);
  revalidatePath(`/minha-conta/candidaturas/${applicationId}`);
  return { ok: true, message: "Candidatura retirada." };
});

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

export const updateProfileAction = createAction(profileSchema, async (input) => {
  const user = await assertUser({ allowUnverified: true });
  await profile.updateProfile(user.id, input);
  revalidatePath("/minha-conta", "layout");
  return { ok: true, message: "Perfil atualizado." };
});

export const saveExperienceAction = createAction(experienceSchema, async (input) => {
  const user = await assertUser({ allowUnverified: true });
  await profile.saveExperience(user.id, input);
  revalidatePath("/minha-conta/perfil");
  return { ok: true, message: "Experiência salva." };
});

export const deleteExperienceAction = createAction(z.object({ id: idSchema }), async ({ id }) => {
  const user = await assertUser({ allowUnverified: true });
  await profile.deleteExperience(user.id, id);
  revalidatePath("/minha-conta/perfil");
  return { ok: true, message: "Experiência removida." };
});

export const saveEducationAction = createAction(educationSchema, async (input) => {
  const user = await assertUser({ allowUnverified: true });
  await profile.saveEducation(user.id, input);
  revalidatePath("/minha-conta/perfil");
  return { ok: true, message: "Formação salva." };
});

export const deleteEducationAction = createAction(z.object({ id: idSchema }), async ({ id }) => {
  const user = await assertUser({ allowUnverified: true });
  await profile.deleteEducation(user.id, id);
  revalidatePath("/minha-conta/perfil");
  return { ok: true, message: "Formação removida." };
});

// ---------------------------------------------------------------------------
// Arquivos (FormData)
// ---------------------------------------------------------------------------

export async function uploadResumeAction(formData: FormData) {
  return runAction(async () => {
    const user = await assertUser({ allowUnverified: true });
    const file = formData.get("file");
    const label = z.string().trim().max(80).catch("").parse(formData.get("label") ?? "");
    if (!(file instanceof File)) throw invalid("Selecione um arquivo PDF.");
    await profile.uploadResume(user.id, file, label);
    revalidatePath("/minha-conta/curriculos");
    return { ok: true, message: "Currículo enviado." };
  });
}

export const setDefaultResumeAction = createAction(z.object({ resumeId: idSchema }), async ({ resumeId }) => {
  const user = await assertUser({ allowUnverified: true });
  await profile.setDefaultResume(user.id, resumeId);
  revalidatePath("/minha-conta/curriculos");
  return { ok: true, message: "Currículo padrão atualizado." };
});

export const deleteResumeAction = createAction(z.object({ resumeId: idSchema }), async ({ resumeId }) => {
  const user = await assertUser({ allowUnverified: true });
  await profile.deleteResume(user.id, resumeId);
  revalidatePath("/minha-conta/curriculos");
  return { ok: true, message: "Currículo excluído." };
});

export async function uploadPhotoAction(formData: FormData) {
  return runAction(async () => {
    const user = await assertUser({ allowUnverified: true });
    const file = formData.get("file");
    if (!(file instanceof File)) throw invalid("Selecione uma imagem.");
    await profile.uploadPhoto(user.id, file);
    revalidatePath("/minha-conta", "layout");
    return { ok: true, message: "Foto atualizada." };
  });
}

export const removePhotoAction = createAction(z.object({}), async () => {
  const user = await assertUser({ allowUnverified: true });
  await profile.removePhoto(user.id);
  revalidatePath("/minha-conta", "layout");
  return { ok: true, message: "Foto removida." };
});

// ---------------------------------------------------------------------------
// Alertas e notificações
// ---------------------------------------------------------------------------

export const createAlertAction = createAction(
  z.object({
    name: z.string().trim().min(2, "Dê um nome ao alerta.").max(80),
    frequency: z.enum(["DAILY", "WEEKLY"], { error: "Escolha a frequência." }),
    filters: alertFiltersSchema,
  }),
  async (input) => {
    const user = await assertUser();
    await saved.createAlert(user.id, input);
    revalidatePath("/minha-conta/alertas");
    return { ok: true, message: "Alerta criado. Você receberá novas vagas por e-mail." };
  },
);

export const updateAlertAction = createAction(
  z.object({ alertId: idSchema, active: z.boolean().optional(), frequency: z.enum(["DAILY", "WEEKLY"]).optional() }),
  async ({ alertId, ...data }) => {
    const user = await assertUser();
    await saved.updateAlert(user.id, alertId, data);
    revalidatePath("/minha-conta/alertas");
    return { ok: true, message: "Alerta atualizado." };
  },
);

export const deleteAlertAction = createAction(z.object({ alertId: idSchema }), async ({ alertId }) => {
  const user = await assertUser();
  await saved.deleteAlert(user.id, alertId);
  revalidatePath("/minha-conta/alertas");
  return { ok: true, message: "Alerta excluído." };
});

export const markNotificationsReadAction = createAction(z.object({}), async () => {
  const user = await assertUser({ allowUnverified: true });
  await markAllRead(user.id);
  revalidatePath("/minha-conta/notificacoes");
});

// ---------------------------------------------------------------------------
// Privacidade (LGPD)
// ---------------------------------------------------------------------------

export const updatePrivacySettingsAction = createAction(privacySettingsSchema, async (input) => {
  const user = await assertUser({ allowUnverified: true });
  await profile.updatePrivacySettings(user.id, input);
  revalidatePath("/minha-conta/privacidade");
  return { ok: true, message: "Preferências de privacidade salvas." };
});

export const createPrivacyRequestAction = createAction(privacyRequestSchema, async (input) => {
  const user = await assertUser({ allowUnverified: true }).catch(() => null);
  const req = await privacy.createPrivacyRequest(input, user?.id ?? null, await getRequestContext());
  return { ok: true, message: `Solicitação registrada. Protocolo: ${req.protocol}`, data: { protocol: req.protocol } };
});

export const deleteAccountAction = createAction(deleteAccountSchema, async ({ password }) => {
  const user = await assertUser({ allowUnverified: true });
  await privacy.deleteAccount(user.id, password, await getRequestContext());
  await clearSessionCookie();
  redirect("/?conta=excluida");
});

export const revokeSessionAction = createAction(z.object({ sessionId: z.string().regex(/^[a-f0-9]{64}$/) }), async ({ sessionId }) => {
  const user = await assertUser({ allowUnverified: true });
  if (sessionId === user.sessionId) throw invalid("Para encerrar a sessão atual, use “Sair”.");
  await db.session.deleteMany({ where: { id: sessionId, userId: user.id } });
  revalidatePath("/minha-conta/seguranca");
  return { ok: true, message: "Sessão encerrada." };
});
