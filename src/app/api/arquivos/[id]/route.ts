import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/dal";
import { roleCan } from "@/server/authz/permissions";
import { audit } from "@/server/audit";
import { isDownloadable, readStoredFile } from "@/server/storage/files";

function contentDisposition(kind: "attachment" | "inline", name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

const notFound = () => new NextResponse("Não encontrado", { status: 404 });

/**
 * Download de arquivos privados com autorização por recurso:
 * - Logo de empresa: público se a empresa for verificada (ou para membros).
 * - Foto de perfil: o próprio titular.
 * - Currículo: o titular, ou membros (com permissão de ver candidaturas) de uma
 *   empresa que recebeu candidatura com ESTE currículo.
 * Respostas negadas retornam 404 para não revelar a existência do arquivo.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/arquivos/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return notFound();

  const file = await db.storedFile.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      storageKey: true,
      originalName: true,
      mimeType: true,
      scanStatus: true,
      ownerUserId: true,
      deletedAt: true,
      orgLogo: { select: { id: true, verificationStatus: true } },
      resume: { select: { id: true, applications: { select: { job: { select: { orgId: true } } } } } },
    },
  });
  if (!file || file.deletedAt || !isDownloadable(file.scanStatus)) return notFound();

  const user = await getCurrentUser();
  let allowed = false;
  let viaOrgId: string | null = null;

  if (file.kind === "ORG_LOGO" && file.orgLogo) {
    allowed = file.orgLogo.verificationStatus === "VERIFIED";
    if (!allowed && user) {
      allowed = Boolean(await db.orgMembership.findUnique({ where: { orgId_userId: { orgId: file.orgLogo.id, userId: user.id } }, select: { id: true } }));
    }
  } else if (user && file.ownerUserId === user.id) {
    allowed = true;
  } else if (user && file.kind === "RESUME" && file.resume) {
    const orgIds = [...new Set(file.resume.applications.map((a) => a.job.orgId))];
    if (orgIds.length) {
      const memberships = await db.orgMembership.findMany({ where: { userId: user.id, orgId: { in: orgIds } }, select: { orgId: true, role: true } });
      const m = memberships.find((x) => roleCan(x.role, "applications.view"));
      if (m) {
        allowed = true;
        viaOrgId = m.orgId;
      }
    }
  }

  if (!allowed) return notFound();

  const body = await readStoredFile(file.storageKey);
  if (viaOrgId) {
    await audit({ actorUserId: user!.id, action: "resume.downloaded_by_company", orgId: viaOrgId, targetType: "Resume", targetId: file.resume!.id });
  }

  const isPdf = file.mimeType === "application/pdf";
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(body.length),
      "Content-Disposition": contentDisposition(isPdf ? "attachment" : "inline", file.originalName),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": file.kind === "ORG_LOGO" ? "public, max-age=3600" : "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
