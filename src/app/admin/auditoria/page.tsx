import { Suspense } from "react";
import { ScrollText } from "lucide-react";
import { EmptyState, PageHeader, SectionSkeleton } from "@/components/common/states";
import { PaginationLinks } from "@/components/common/pagination-links";
import { requirePlatformAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Auditoria" };
const PAGE = 50;

export default function AuditPage(props: PageProps<"/admin/auditoria">) {
  return (
    <div className="space-y-6">
      <PageHeader title="Trilha de auditoria" description="Eventos de autenticação, autorização, moderação, privacidade e dados. Metadados são sanitizados (sem senhas, tokens, documentos ou e-mails completos); IPs são pseudonimizados." />
      <form method="get" className="flex flex-wrap gap-2" role="search">
        <label htmlFor="acao" className="sr-only">Ação</label>
        <input id="acao" name="acao" placeholder="Prefixo da ação (ex.: auth., admin., application.)" className="h-9 w-80 max-w-full rounded-lg border bg-card px-3 text-sm" />
        <label htmlFor="ator" className="sr-only">ID do ator</label>
        <input id="ator" name="ator" placeholder="ID do usuário (ator)" className="h-9 w-64 max-w-full rounded-lg border bg-card px-3 text-sm" />
        <button className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Filtrar</button>
      </form>
      <Suspense fallback={<SectionSkeleton rows={10} />}>
        <List searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/admin/auditoria">["searchParams"] }) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const acao = typeof sp.acao === "string" ? sp.acao.trim().slice(0, 60) : "";
  const ator = typeof sp.ator === "string" && /^[a-z0-9]{20,40}$/i.test(sp.ator) ? sp.ator : undefined;
  const page = Math.max(1, Math.min(200, Number(sp.pagina) || 1));
  const where = { ...(acao ? { action: { startsWith: acao } } : {}), ...(ator ? { actorUserId: ator } : {}) };
  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { actor: { select: { name: true } }, org: { select: { tradeName: true } } } }),
  ]);
  if (!logs.length) return <EmptyState icon={ScrollText} title="Nenhum evento encontrado" />;
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (acao) params.set("acao", acao);
    if (ator) params.set("ator", ator);
    params.set("pagina", String(p));
    return `/admin/auditoria?${params}`;
  };
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2">Quando</th>
              <th scope="col" className="px-3 py-2">Ação</th>
              <th scope="col" className="px-3 py-2">Ator</th>
              <th scope="col" className="px-3 py-2">Alvo</th>
              <th scope="col" className="px-3 py-2">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateTime(l.createdAt)}</td>
                <td className="px-3 py-2 font-mono text-xs">{l.action}</td>
                <td className="px-3 py-2">{l.actor?.name ?? "—"}{l.org ? <span className="block text-xs text-muted-foreground">{l.org.tradeName}</span> : null}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{l.targetType ? `${l.targetType} ${l.targetId?.slice(0, 10)}…` : "—"}</td>
                <td className="max-w-xs px-3 py-2"><code className="line-clamp-3 break-all text-xs">{l.metadata ? JSON.stringify(l.metadata) : ""}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationLinks page={page} pages={Math.ceil(total / PAGE)} hrefFor={qs} />
    </div>
  );
}
