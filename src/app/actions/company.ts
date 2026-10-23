"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, runAction } from "@/server/action";
import { assertOrgPermission, assertUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { invalid } from "@/server/errors";
import * as orgs from "@/server/services/organizations";
import * as jobs from "@/server/services/jobs";
import * as applications from "@/server/services/applications";
import { deleteStoredFile, storeUpload } from "@/server/storage/files";
import { enforceRateLimits } from "@/server/security/rate-limit";
import { idSchema, optionalText } from "@/lib/validation/common";
import { jobSchema } from "@/lib/validation/job";
import { changeRoleSchema, createOrgSchema, inviteSchema, updateOrgSchema } from "@/lib/validation/org";

export const createOrgAction = createAction(createOrgSchema, async (input) => {
  const user = await assertUser();
  const org = await orgs.createOrganization(user, input);
  redirect(`/empresa/${org.id}?criada=1`);
});

export const updateOrgAction = createAction(updateOrgSchema.extend({ orgId: idSchema }), async ({ orgId, ...input }) => {
  const access = await assertOrgPermission(orgId, "org.edit");
  await orgs.updateOrganization(access, input);
  revalidatePath(`/empresa/${orgId}`, "layout");
  return { ok: true, message: "Perfil da empresa atualizado." };
});

export const requestReverificationAction = createAction(z.object({ orgId: idSchema }), async ({ orgId }) => {
  const access = await assertOrgPermission(orgId, "org.edit");
  await orgs.requestReverification(access);
  revalidatePath(`/empresa/${orgId}`, "layout");
  return { ok: true, message: "Empresa reenviada para análise." };
});

export async function uploadOrgLogoAction(formData: FormData) {
  return runAction(async () => {
    const orgId = idSchema.parse(formData.get("orgId"));
    const access = await assertOrgPermission(orgId, "org.edit");
    await enforceRateLimits([{ key: `upload:org:${orgId}`, limit: 20, windowSeconds: 3600 }]);
    const file = formData.get("file");
    if (!(file instanceof File)) throw invalid("Selecione uma imagem.");
    const stored = await storeUpload({ kind: "ORG_LOGO", file, ownerUserId: access.user.id, orgId });
    const prev = await db.organization.findUnique({ where: { id: orgId }, select: { logoFileId: true } });
    await db.organization.update({ where: { id: orgId }, data: { logoFileId: stored.id } });
    if (prev?.logoFileId) await deleteStoredFile(prev.logoFileId);
    await audit({ actorUserId: access.user.id, action: "org.logo_updated", orgId });
    revalidatePath(`/empresa/${orgId}`, "layout");
    return { ok: true, message: "Logo atualizado." };
  });
}

// ---------------------------------------------------------------------------
// Vagas
// ---------------------------------------------------------------------------

export const createJobAction = createAction(jobSchema.extend({ orgId: idSchema }), async ({ orgId, ...data }) => {
  const access = await assertOrgPermission(orgId, "jobs.manage");
  const job = await jobs.createJob(access, data);
  redirect(`/empresa/${orgId}/vagas/${job.id}?status=${job.status}`);
});

export const updateJobAction = createAction(jobSchema.extend({ orgId: idSchema, jobId: idSchema }), async ({ orgId, jobId, ...data }) => {
  const access = await assertOrgPermission(orgId, "jobs.manage");
  const res = await jobs.updateJob(access, jobId, data);
  revalidatePath(`/vagas/${jobId}`);
  redirect(`/empresa/${orgId}/vagas/${jobId}?status=${res.status}`);
});

export const jobLifecycleAction = createAction(
  z.object({ orgId: idSchema, jobId: idSchema, action: z.enum(["pause", "resume", "close"]) }),
  async ({ orgId, jobId, action }) => {
    const access = await assertOrgPermission(orgId, "jobs.manage");
    await jobs.changeJobLifecycle(access, jobId, action);
    revalidatePath(`/empresa/${orgId}/vagas`);
    revalidatePath(`/empresa/${orgId}/vagas/${jobId}`);
    revalidatePath(`/vagas/${jobId}`);
    const msg = { pause: "Vaga pausada.", resume: "Vaga reativada.", close: "Vaga encerrada." }[action];
    return { ok: true, message: msg };
  },
);

// ---------------------------------------------------------------------------
// Candidaturas
// ---------------------------------------------------------------------------

export const updateApplicationStatusAction = createAction(
  z.object({
    orgId: idSchema,
    applicationId: idSchema,
    to: z.enum(["IN_REVIEW", "INTERVIEW", "APPROVED", "REJECTED"]),
    messageToCandidate: optionalText(1500, "Mensagem"),
    internalNote: optionalText(1500, "Nota interna"),
  }),
  async ({ orgId, ...input }) => {
    const access = await assertOrgPermission(orgId, "applications.update");
    await applications.updateApplicationStatus(access, input);
    revalidatePath(`/empresa/${orgId}`, "layout");
    return { ok: true, message: "Status atualizado e candidato(a) notificado(a)." };
  },
);

// ---------------------------------------------------------------------------
// Membros
// ---------------------------------------------------------------------------

export const inviteMemberAction = createAction(inviteSchema.extend({ orgId: idSchema }), async ({ orgId, email, role }) => {
  const access = await assertOrgPermission(orgId, "org.members.manage");
  await orgs.inviteMember(access, email, role);
  revalidatePath(`/empresa/${orgId}/membros`);
  return { ok: true, message: "Convite enviado por e-mail." };
});

export const revokeInvitationAction = createAction(z.object({ orgId: idSchema, invitationId: idSchema }), async ({ orgId, invitationId }) => {
  const access = await assertOrgPermission(orgId, "org.members.manage");
  await orgs.revokeInvitation(access, invitationId);
  revalidatePath(`/empresa/${orgId}/membros`);
  return { ok: true, message: "Convite revogado." };
});

export const changeMemberRoleAction = createAction(changeRoleSchema.extend({ orgId: idSchema }), async ({ orgId, membershipId, role }) => {
  const access = await assertOrgPermission(orgId, "org.members.manage");
  await orgs.changeMemberRole(access, membershipId, role);
  revalidatePath(`/empresa/${orgId}/membros`);
  return { ok: true, message: "Papel atualizado." };
});

export const removeMemberAction = createAction(z.object({ orgId: idSchema, membershipId: idSchema }), async ({ orgId, membershipId }) => {
  const access = await assertOrgPermission(orgId, "org.view");
  await orgs.removeMember(access, membershipId);
  if (membershipId === access.membership.id) redirect("/empresa");
  revalidatePath(`/empresa/${orgId}/membros`);
  return { ok: true, message: "Membro removido." };
});

export const acceptInvitationAction = createAction(z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{30,64}$/) }), async ({ token }) => {
  const user = await assertUser();
  const orgId = await orgs.acceptInvitation(user, token);
  redirect(`/empresa/${orgId}`);
});
