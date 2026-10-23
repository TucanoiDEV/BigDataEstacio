import { Suspense } from "react";
import { BellRing } from "lucide-react";
import { EmptyState, PageHeader, SectionSkeleton } from "@/components/common/states";
import { AlertForm, AlertRowActions } from "@/components/candidate/alerts";
import { requireUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { CONTRACT_TYPE_LABEL, SENIORITY_LABEL, WORK_MODEL_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { alertFiltersSchema, parseJobSearch, type AlertFilters } from "@/lib/validation/search";

export const metadata = { title: "Alertas de vagas" };

function describe(f: AlertFilters): string {
  const parts = [
    f.q && `“${f.q}”`,
    f.city && f.city,
    f.uf && f.uf,
    f.setor,
    ...f.modalidade.map((m) => WORK_MODEL_LABEL[m]),
    ...f.contrato.map((c) => CONTRACT_TYPE_LABEL[c]),
    ...f.senioridade.map((s) => SENIORITY_LABEL[s]),
    f.salarioMin && `a partir de R$ ${f.salarioMin.toLocaleString("pt-BR")}`,
  ].filter(Boolean);
  return parts.join(" · ") || "Sem filtros";
}

export default function AlertsPage(props: PageProps<"/minha-conta/alertas">) {
  return (
    <div className="space-y-6">
      <PageHeader title="Alertas de vagas" description="Receba por e-mail as novas vagas que combinam com uma busca. Você pode pausar ou excluir a qualquer momento." />
      <Suspense fallback={<SectionSkeleton rows={6} />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/minha-conta/alertas">["searchParams"] }) {
  const user = await requireUser({ returnTo: "/minha-conta/alertas" });
  const prefill = parseJobSearch(await searchParams);
  const [alerts, pref] = await Promise.all([
    db.jobAlert.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.communicationPreference.findUnique({ where: { userId: user.id }, select: { emailJobAlerts: true } }),
  ]);
  const filters = alertFiltersSchema.parse(prefill);

  return (
    <div className="space-y-6">
      {pref && !pref.emailJobAlerts && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          O envio de alertas por e-mail está desativado nas suas preferências de comunicação (Privacidade).
        </p>
      )}
      <AlertForm filters={filters} summary={describe(filters)} />
      {alerts.length === 0 ? (
        <EmptyState icon={BellRing} title="Nenhum alerta criado" description="Faça uma busca em “Explorar vagas” e use “Criar alerta com esta busca”." />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {alerts.map((a) => {
            const f = alertFiltersSchema.safeParse(a.filters);
            return (
              <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{a.name} {!a.active && <span className="text-xs text-muted-foreground">(pausado)</span>}</p>
                  <p className="truncate text-sm text-muted-foreground">{f.success ? describe(f.data) : "Filtros inválidos"}</p>
                  <p className="text-xs text-muted-foreground">{a.frequency === "DAILY" ? "Diário" : "Semanal"} · último envio: {a.lastSentAt ? formatDate(a.lastSentAt) : "ainda não enviado"}</p>
                </div>
                <AlertRowActions alertId={a.id} active={a.active} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
