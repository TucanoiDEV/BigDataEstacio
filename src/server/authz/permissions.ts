import type { OrgRole } from "@/generated/prisma/browser";

// Matriz de permissões por papel na organização. Avaliada SEMPRE no servidor.
export type OrgPermission =
  | "org.view"
  | "org.edit"
  | "org.members.manage"
  | "jobs.view"
  | "jobs.manage"
  | "applications.view"
  | "applications.update";

const MATRIX: Record<OrgRole, readonly OrgPermission[]> = {
  OWNER: ["org.view", "org.edit", "org.members.manage", "jobs.view", "jobs.manage", "applications.view", "applications.update"],
  ADMIN: ["org.view", "org.edit", "org.members.manage", "jobs.view", "jobs.manage", "applications.view", "applications.update"],
  RECRUITER: ["org.view", "jobs.view", "jobs.manage", "applications.view", "applications.update"],
  VIEWER: ["org.view", "jobs.view", "applications.view"],
};

export function roleCan(role: OrgRole, permission: OrgPermission): boolean {
  return MATRIX[role].includes(permission);
}

const RANK: Record<OrgRole, number> = { OWNER: 4, ADMIN: 3, RECRUITER: 2, VIEWER: 1 };

/**
 * Quem pode conceder/alterar/remover um papel: apenas quem gerencia membros e
 * nunca acima do próprio nível. Somente OWNER cria/remove outro OWNER.
 */
export function canManageRole(actor: OrgRole, target: OrgRole): boolean {
  if (!roleCan(actor, "org.members.manage")) return false;
  if (target === "OWNER") return actor === "OWNER";
  return RANK[actor] >= RANK[target];
}
