import "server-only";
import type { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { conflict, invalid, notFound } from "@/server/errors";
import { upsertSkills } from "@/server/services/skills";
import { deleteStoredFile, storeUpload } from "@/server/storage/files";
import { enforceRateLimits } from "@/server/security/rate-limit";
import type { educationSchema, experienceSchema, privacySettingsSchema, profileSchema } from "@/lib/validation/profile";
import { LEGAL_VERSIONS } from "@/lib/constants";

export async function ensureProfile(userId: string) {
  return db.candidateProfile.upsert({ where: { userId }, create: { userId }, update: {}, select: { userId: true } });
}

export async function getFullProfile(userId: string) {
  await ensureProfile(userId);
  return db.candidateProfile.findUniqueOrThrow({
    where: { userId },
    include: {
      user: { select: { name: true, email: true } },
      experiences: { orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }] },
      educations: { orderBy: [{ inProgress: "desc" }, { endDate: "desc" }] },
      skills: { include: { skill: true } },
      resumes: { include: { file: { select: { originalName: true, sizeBytes: true, scanStatus: true, createdAt: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function updateProfile(userId: string, input: z.output<typeof profileSchema>) {
  const { name, skills, ...data } = input;
  await ensureProfile(userId);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { name } });
    await tx.candidateProfile.update({ where: { userId }, data });
    const rows = await upsertSkills(tx, skills);
    await tx.profileSkill.deleteMany({ where: { profileId: userId } });
    if (rows.length) await tx.profileSkill.createMany({ data: rows.map((s) => ({ profileId: userId, skillId: s.id })) });
  });
  await audit({ actorUserId: userId, action: "profile.updated", targetType: "CandidateProfile", targetId: userId });
}

export async function saveExperience(userId: string, input: z.output<typeof experienceSchema>) {
  await ensureProfile(userId);
  const { id, ...data } = input;
  const payload = { ...data, endDate: data.isCurrent ? null : data.endDate };
  if (id) {
    // Escopo pelo dono impede alterar experiências de terceiros.
    const res = await db.experience.updateMany({ where: { id, profileId: userId }, data: payload });
    if (res.count === 0) throw notFound();
  } else {
    const count = await db.experience.count({ where: { profileId: userId } });
    if (count >= 30) throw invalid("Limite de 30 experiências.");
    await db.experience.create({ data: { ...payload, profileId: userId } });
  }
}

export async function deleteExperience(userId: string, id: string) {
  const res = await db.experience.deleteMany({ where: { id, profileId: userId } });
  if (res.count === 0) throw notFound();
}

export async function saveEducation(userId: string, input: z.output<typeof educationSchema>) {
  await ensureProfile(userId);
  const { id, ...data } = input;
  if (id) {
    const res = await db.education.updateMany({ where: { id, profileId: userId }, data });
    if (res.count === 0) throw notFound();
  } else {
    const count = await db.education.count({ where: { profileId: userId } });
    if (count >= 20) throw invalid("Limite de 20 formações.");
    await db.education.create({ data: { ...data, profileId: userId } });
  }
}

export async function deleteEducation(userId: string, id: string) {
  const res = await db.education.deleteMany({ where: { id, profileId: userId } });
  if (res.count === 0) throw notFound();
}

export async function updatePrivacySettings(userId: string, input: z.output<typeof privacySettingsSchema>) {
  await ensureProfile(userId);
  const before = await db.communicationPreference.findUnique({ where: { userId } });
  await db.$transaction([
    db.candidateProfile.update({
      where: { userId },
      data: {
        visibility: input.visibility,
        showEmailToCompanies: input.showEmailToCompanies,
        showPhoneToCompanies: input.showPhoneToCompanies,
        recommendationsEnabled: input.recommendationsEnabled,
      },
    }),
    db.communicationPreference.upsert({
      where: { userId },
      create: { userId, emailApplicationUpdates: input.emailApplicationUpdates, emailJobAlerts: input.emailJobAlerts, emailProductNews: input.emailProductNews },
      update: { emailApplicationUpdates: input.emailApplicationUpdates, emailJobAlerts: input.emailJobAlerts, emailProductNews: input.emailProductNews },
    }),
  ]);
  // Novidades por e-mail dependem de consentimento: registra concessão/revogação.
  if ((before?.emailProductNews ?? false) !== input.emailProductNews) {
    await db.consentRecord.create({
      data: { userId, kind: "PRODUCT_NEWS", version: LEGAL_VERSIONS.privacy, action: input.emailProductNews ? "GRANT" : "REVOKE", choices: { emailProductNews: input.emailProductNews } },
    });
  }
  await audit({ actorUserId: userId, action: "privacy.settings_updated", metadata: { visibility: input.visibility } });
}

// ---------------------------------------------------------------------------
// Currículos e foto
// ---------------------------------------------------------------------------

export async function uploadResume(userId: string, file: File, label: string) {
  await enforceRateLimits([{ key: `upload:user:${userId}`, limit: 20, windowSeconds: 3600 }]);
  await ensureProfile(userId);
  const count = await db.resume.count({ where: { profileId: userId } });
  if (count >= 5) throw invalid("Você pode manter até 5 currículos. Exclua um para enviar outro.");
  const stored = await storeUpload({ kind: "RESUME", file, ownerUserId: userId });
  const resume = await db.resume.create({
    data: { profileId: userId, fileId: stored.id, label: label || stored.originalName, isDefault: count === 0 },
    select: { id: true },
  });
  await audit({ actorUserId: userId, action: "resume.uploaded", targetType: "Resume", targetId: resume.id, metadata: { sizeBytes: stored.sizeBytes, scan: stored.scanStatus } });
  return resume;
}

export async function setDefaultResume(userId: string, resumeId: string) {
  const resume = await db.resume.findFirst({ where: { id: resumeId, profileId: userId }, select: { id: true } });
  if (!resume) throw notFound();
  await db.$transaction([
    db.resume.updateMany({ where: { profileId: userId, isDefault: true }, data: { isDefault: false } }),
    db.resume.update({ where: { id: resumeId }, data: { isDefault: true } }),
  ]);
}

export async function deleteResume(userId: string, resumeId: string) {
  const resume = await db.resume.findFirst({
    where: { id: resumeId, profileId: userId },
    select: { id: true, fileId: true, isDefault: true, applications: { where: { status: { in: ["SUBMITTED", "IN_REVIEW", "INTERVIEW"] } }, select: { id: true } } },
  });
  if (!resume) throw notFound();
  if (resume.applications.length) {
    throw conflict("Este currículo está vinculado a candidaturas em andamento. Retire-as ou aguarde a conclusão antes de excluir.");
  }
  await db.resume.delete({ where: { id: resume.id } });
  await deleteStoredFile(resume.fileId);
  if (resume.isDefault) {
    const next = await db.resume.findFirst({ where: { profileId: userId }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (next) await db.resume.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  await audit({ actorUserId: userId, action: "resume.deleted", targetType: "Resume", targetId: resumeId });
}

export async function uploadPhoto(userId: string, file: File) {
  await enforceRateLimits([{ key: `upload:user:${userId}`, limit: 20, windowSeconds: 3600 }]);
  await ensureProfile(userId);
  const stored = await storeUpload({ kind: "PHOTO", file, ownerUserId: userId });
  const previous = await db.candidateProfile.findUnique({ where: { userId }, select: { photoFileId: true } });
  await db.candidateProfile.update({ where: { userId }, data: { photoFileId: stored.id } });
  if (previous?.photoFileId) await deleteStoredFile(previous.photoFileId);
}

export async function removePhoto(userId: string) {
  const previous = await db.candidateProfile.findUnique({ where: { userId }, select: { photoFileId: true } });
  if (!previous?.photoFileId) return;
  await db.candidateProfile.update({ where: { userId }, data: { photoFileId: null } });
  await deleteStoredFile(previous.photoFileId);
}
