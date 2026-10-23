import "server-only";
import type { NotificationType } from "@/generated/prisma/client";
import { db, type Tx } from "@/server/db";

export async function notify(
  input: { userId: string; type: NotificationType; title: string; body: string; link?: string },
  tx?: Tx,
): Promise<void> {
  await (tx ?? db).notification.create({ data: input });
}

export async function notifyMany(
  userIds: string[],
  input: { type: NotificationType; title: string; body: string; link?: string },
  tx?: Tx,
): Promise<void> {
  if (!userIds.length) return;
  await (tx ?? db).notification.createMany({ data: userIds.map((userId) => ({ userId, ...input })) });
}

export async function platformAdminIds(): Promise<string[]> {
  const admins = await db.user.findMany({ where: { platformRole: "PLATFORM_ADMIN", status: "ACTIVE" }, select: { id: true } });
  return admins.map((a) => a.id);
}

export async function markAllRead(userId: string) {
  await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
