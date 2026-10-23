import { Suspense } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { EmptyState, PageHeader, SectionSkeleton, StatusBadge } from "@/components/common/states";
import { IncidentForm } from "@/components/admin/incident-form";
import { requirePlatformAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Incidentes de segurança" };

const SEV = { LOW: ["gray", "Baixa"], MEDIUM: ["amber", "Média"], HIGH: ["red", "Alta"], CRITICAL: ["red", "Crítica"] } as const;
const ST = { OPEN: ["red", "Aberto"], CONTAINED: ["amber", "Contido"], RESOLVED: ["green", "Resolvido"] } as const;

export default function IncidentsPage(props: PageProps<"/admin/incidentes">) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidentes de segurança"
        description={
          <>
            Registro interno para demonstrar a resposta a incidentes. Incidentes que possam acarretar risco ou dano relevante aos titulares devem ser
            comunicados à ANPD e aos titulares no prazo da regulamentação vigente (a Resolução CD/ANPD nº 15/2024 prevê 3 dias úteis — confirme com a
            assessoria jurídica). O procedimento completo está em <code>docs/RESPOSTA-A-INCIDENTES.md</code>.{" "}
            <Link href="/seguranca" className="text-primary underline">Página pública de segurança</Link>.
          </>
        }
      />
      <Suspense fallback={<SectionSkeleton rows={8} />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

const iso = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

async function Content({ searchParams }: { searchParams: PageProps<"/admin/incidentes">["searchParams"] }) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const incidents = await db.securityIncident.findMany({ orderBy: [{ status: "asc" }, { detectedAt: "desc" }], take: 100 });
  const editing = typeof sp.editar === "string" ? incidents.find((i) => i.id === sp.editar) : undefined;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="mb-4 font-semibold text-petroleum">{editing ? "Atualizar incidente" : "Registrar incidente"}</h2>
        <IncidentForm
          key={editing?.id ?? "new"}
          defaults={
            editing
              ? {
                  id: editing.id,
                  title: editing.title,
                  description: editing.description,
                  severity: editing.severity,
                  status: editing.status,
                  detectedAt: iso(editing.detectedAt),
                  personalDataAffected: editing.personalDataAffected,
                  dataCategories: editing.dataCategories.join(", "),
                  estimatedSubjects: editing.estimatedSubjects,
                  riskAssessment: editing.riskAssessment ?? "",
                  anpdNotificationRequired: editing.anpdNotificationRequired === null ? "undetermined" : editing.anpdNotificationRequired ? "yes" : "no",
                  anpdNotifiedAt: iso(editing.anpdNotifiedAt),
                  subjectsNotifiedAt: iso(editing.subjectsNotifiedAt),
                  actionsTaken: editing.actionsTaken ?? "",
                }
              : undefined
          }
        />
      </section>
      {incidents.length === 0 ? <EmptyState icon={ShieldAlert} title="Nenhum incidente registrado" /> : (
        <ul className="divide-y rounded-2xl border bg-card">
          {incidents.map((i) => (
            <li key={i.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">{i.title}</p>
                <p className="text-muted-foreground">
                  Detectado {formatDateTime(i.detectedAt)} · dados pessoais: {i.personalDataAffected ? "sim" : "não"} · ANPD:{" "}
                  {i.anpdNotifiedAt ? `comunicada em ${formatDateTime(i.anpdNotifiedAt)}` : i.anpdNotificationRequired ? "comunicação PENDENTE" : i.anpdNotificationRequired === false ? "não exigida" : "a avaliar"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={SEV[i.severity][0]}>{SEV[i.severity][1]}</StatusBadge>
                <StatusBadge tone={ST[i.status][0]}>{ST[i.status][1]}</StatusBadge>
                <Link href={`/admin/incidentes?editar=${i.id}`} className="text-sm font-medium text-primary hover:underline">Editar</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
