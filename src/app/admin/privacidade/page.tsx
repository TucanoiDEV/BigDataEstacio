import { Suspense } from "react";
import { FileLock2 } from "lucide-react";
import { EmptyState, PageHeader, SectionSkeleton, StatusBadge } from "@/components/common/states";
import { PrivacyDecision } from "@/components/admin/controls";
import { requirePlatformAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { PRIVACY_REQUEST_LABEL } from "@/lib/validation/privacy";

export const metadata = { title: "Solicitações LGPD" };

export default function AdminPrivacyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicitações de titulares (LGPD)"
        description="Registro de atendimento dos direitos do art. 18. Antes de entregar dados ou excluir, confirme a identidade do solicitante (ex.: resposta a partir do e-mail da conta)."
      />
      <Suspense fallback={<SectionSkeleton rows={8} />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  await requirePlatformAdmin();
  const now = new Date();
  const items = await db.privacyRequest.findMany({
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: 100,
    include: { user: { select: { email: true } }, handledBy: { select: { name: true } } },
  });
  if (!items.length) return <EmptyState icon={FileLock2} title="Nenhuma solicitação registrada" />;
  return (
    <ul className="space-y-4">
      {items.map((r) => {
        const open = r.status === "OPEN" || r.status === "IN_PROGRESS";
        const overdue = open && r.dueAt < now;
        return (
          <li key={r.id} className={`rounded-2xl border bg-card p-5 ${overdue ? "border-red-300" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{PRIVACY_REQUEST_LABEL[r.type]} · {r.protocol}</p>
              <StatusBadge tone={r.status === "COMPLETED" ? "green" : r.status === "REJECTED" ? "red" : overdue ? "red" : "amber"}>
                {r.status === "OPEN" ? "Aberta" : r.status === "IN_PROGRESS" ? "Em atendimento" : r.status === "COMPLETED" ? "Concluída" : "Indeferida"}{overdue ? " · prazo vencido" : ""}
              </StatusBadge>
            </div>
            <p className="text-sm text-muted-foreground">
              {r.requesterName} &lt;{r.requesterEmail}&gt; {r.user ? `(conta: ${r.user.email})` : "(sem conta vinculada)"} · aberta {formatDateTime(r.createdAt)} · prazo {formatDate(r.dueAt)}
              {r.handledBy ? ` · responsável: ${r.handledBy.name}` : ""}
            </p>
            <p className="mt-2 whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm">{r.description}</p>
            {r.response && <p className="mt-2 text-sm"><span className="font-medium">Resposta:</span> {r.response}</p>}
            {open && <div className="mt-4"><PrivacyDecision id={r.id} /></div>}
          </li>
        );
      })}
    </ul>
  );
}
