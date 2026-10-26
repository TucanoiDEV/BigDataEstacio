import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { db } from "@/server/db";
import { publicJobWhere } from "@/server/services/jobs";

const STATIC = ["/", "/vagas", "/empresas", "/mercado-de-trabalho", "/mercado-de-trabalho/metodologia", "/privacidade", "/cookies", "/termos", "/seguranca", "/central-de-privacidade", "/contato", "/criar-conta"];

// Apenas páginas públicas e vagas reais ATIVAS. Perfis e currículos nunca entram.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const now = new Date();
  const [jobs, orgs] = await Promise.all([
    db.job.findMany({ where: { ...publicJobWhere(now), org: { verificationStatus: "VERIFIED", isDemo: false } }, select: { id: true, updatedAt: true }, orderBy: { publishedAt: "desc" }, take: 45000 }),
    db.organization.findMany({ where: { verificationStatus: "VERIFIED", isDemo: false }, select: { slug: true, updatedAt: true }, take: 5000 }),
  ]);
  return [
    ...STATIC.map((p) => ({ url: `${base}${p}`, changeFrequency: "daily" as const })),
    ...jobs.map((j) => ({ url: `${base}/vagas/${j.id}`, lastModified: j.updatedAt, changeFrequency: "daily" as const })),
    ...orgs.map((o) => ({ url: `${base}/empresas/${o.slug}`, lastModified: o.updatedAt })),
  ];
}
