import "server-only";
import type { Tx } from "@/server/db";
import { slugify } from "@/lib/text";

/** Garante a existência das competências (por slug) e retorna seus IDs. */
export async function upsertSkills(tx: Tx, names: string[]): Promise<{ id: string; slug: string; name: string }[]> {
  const unique = new Map<string, string>();
  for (const name of names) {
    const slug = slugify(name, 40);
    if (slug && !unique.has(slug)) unique.set(slug, name.trim());
  }
  if (unique.size === 0) return [];
  await tx.skill.createMany({
    data: [...unique].map(([slug, name]) => ({ slug, name })),
    skipDuplicates: true,
  });
  return tx.skill.findMany({ where: { slug: { in: [...unique.keys()] } }, select: { id: true, slug: true, name: true } });
}
