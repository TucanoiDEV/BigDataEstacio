import { Suspense } from "react";
import Link from "next/link";
import { Building2, ExternalLink } from "lucide-react";
import { EmptyState, PageHeader, SectionSkeleton } from "@/components/common/states";
import { OrgStatusBadge } from "@/components/common/application-status-badge";
import { OrgDecision } from "@/components/admin/controls";
import { requirePlatformAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";
import { formatCnpj } from "@/lib/cnpj";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Empresas" };

const FILTERS = [
  { key: "PENDING", label: "Pendentes" },
  { key: "VERIFIED", label: "Verificadas" },
  { key: "REJECTED", label: "Recusadas" },
  { key: "SUSPENDED", label: "Suspensas" },
] as const;

export default function AdminOrgsPage(props: PageProps<"/admin/empresas">) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Verificação de empresas"
        description="Antes de verificar: confira a situação cadastral do CNPJ em fonte oficial (Receita Federal), a correspondência entre razão social, site e domínio do e-mail, e sinais de golpe."
      />
      <Suspense fallback={<SectionSkeleton rows={8} />}>
        <List searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/admin/empresas">["searchParams"] }) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const status = FILTERS.find((f) => f.key === sp.status)?.key ?? "PENDING";
  const orgs = await db.organization.findMany({
    where: { verificationStatus: status },
    orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
    take: 50,
    include: {
      members: { where: { role: "OWNER" }, select: { user: { select: { name: true, email: true, emailVerifiedAt: true, createdAt: true } } } },
      _count: { select: { jobs: true, reports: true } },
    },
  });
  return (
    <div className="space-y-4">
      <nav aria-label="Filtrar por status" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/admin/empresas?status=${f.key}`} aria-current={f.key === status ? "page" : undefined} className={`rounded-full border px-3 py-1 text-sm ${f.key === status ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>{f.label}</Link>
        ))}
      </nav>
      {orgs.length === 0 ? <EmptyState icon={Building2} title="Nada nesta fila" /> : (
        <ul className="space-y-4">
          {orgs.map((o) => {
            const domain = o.contactEmail.split("@")[1];
            const siteHost = o.website ? new URL(o.website).hostname.replace(/^www\./, "") : null;
            const domainMatch = siteHost ? domain === siteHost || domain.endsWith(`.${siteHost}`) : false;
            return (
              <li key={o.id} className="rounded-2xl border bg-card p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold">{o.tradeName}</p>
                    <p className="text-sm text-muted-foreground">{o.legalName} · CNPJ {formatCnpj(o.cnpj)}</p>
                  </div>
                  <OrgStatusBadge status={o.verificationStatus} />
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div><dt className="inline text-muted-foreground">Contato: </dt><dd className="inline">{o.contactEmail}</dd></div>
                  <div>
                    <dt className="inline text-muted-foreground">Site: </dt>
                    <dd className="inline">{o.website ? <a href={o.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">{siteHost} <ExternalLink className="size-3" aria-hidden /></a> : "não informado"}</dd>
                  </div>
                  <div><dt className="inline text-muted-foreground">Domínio do e-mail confere com o site: </dt><dd className={`inline font-medium ${domainMatch ? "text-emerald-700" : "text-amber-800"}`}>{domainMatch ? "sim" : "não"}</dd></div>
                  <div><dt className="inline text-muted-foreground">Local: </dt><dd className="inline">{[o.city, o.state].filter(Boolean).join("/") || "—"}</dd></div>
                  <div><dt className="inline text-muted-foreground">Cadastro: </dt><dd className="inline">{formatDate(o.createdAt)} · {o._count.jobs} vaga(s) · {o._count.reports} denúncia(s)</dd></div>
                  {o.members.map((m) => (
                    <div key={m.user.email}><dt className="inline text-muted-foreground">Responsável: </dt><dd className="inline">{m.user.name} ({m.user.email}{m.user.emailVerifiedAt ? ", e-mail verificado" : ", e-mail NÃO verificado"})</dd></div>
                  ))}
                </dl>
                {o.verificationNotes && <p className="mt-2 text-sm text-muted-foreground">Notas anteriores: {o.verificationNotes}</p>}
                <div className="mt-4"><OrgDecision orgId={o.id} status={o.verificationStatus} /></div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
