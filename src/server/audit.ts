import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/server/db";
import { redact } from "@/lib/redact";

export type AuditEntry = {
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  orgId?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Registra evento de auditoria. Metadados passam por `redact` (sem senhas,
 * tokens, documentos ou e-mails completos). Falhas de auditoria não derrubam
 * a operação principal fora de transação, mas são registradas no console.
 */
export async function audit(entry: AuditEntry, tx?: Tx): Promise<void> {
  const data = {
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    orgId: entry.orgId ?? null,
    ipHash: entry.ipHash ?? null,
    userAgent: entry.userAgent ?? null,
    metadata: entry.metadata ? (redact(entry.metadata) as Prisma.InputJsonValue) : undefined,
  };
  if (tx) {
    await tx.auditLog.create({ data });
    return;
  }
  try {
    await db.auditLog.create({ data });
  } catch (err) {
    console.error("[audit] falha ao registrar evento", entry.action, err instanceof Error ? err.message : err);
  }
}
