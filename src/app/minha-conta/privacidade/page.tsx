import { Suspense } from "react";
import Link from "next/link";
import { Download, FileLock2 } from "lucide-react";
import { PageHeader, SectionSkeleton, StatusBadge } from "@/components/common/states";
import { DeleteAccountForm, PrivacySettingsForm } from "@/components/candidate/privacy-forms";
import { PrivacyRequestForm } from "@/components/privacy/privacy-request-form";
import { requireUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { ensureProfile } from "@/server/services/profile";
import { formatDate } from "@/lib/format";
import { PRIVACY_REQUEST_LABEL } from "@/lib/validation/privacy";

export const metadata = { title: "Privacidade" };

const STATUS = { OPEN: ["amber", "Aberta"], IN_PROGRESS: ["blue", "Em atendimento"], COMPLETED: ["green", "Concluída"], REJECTED: ["red", "Indeferida"] } as const;

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Privacidade e seus dados"
        description={<>Controle quem vê seu perfil, como falamos com você e exerça seus direitos previstos na LGPD. Veja também a <Link href="/privacidade" className="text-primary underline">Política de Privacidade</Link>.</>}
      />
      <Suspense fallback={<SectionSkeleton rows={10} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const user = await requireUser({ returnTo: "/minha-conta/privacidade", allowUnverified: true });
  await ensureProfile(user.id);
  const [profile, pref, requests] = await Promise.all([
    db.candidateProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { visibility: true, showEmailToCompanies: true, showPhoneToCompanies: true, recommendationsEnabled: true } }),
    db.communicationPreference.findUnique({ where: { userId: user.id } }),
    db.privacyRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="space-y-6">
      <PrivacySettingsForm
        defaults={{
          visibility: profile.visibility,
          showEmailToCompanies: profile.showEmailToCompanies,
          showPhoneToCompanies: profile.showPhoneToCompanies,
          recommendationsEnabled: profile.recommendationsEnabled,
          emailApplicationUpdates: pref?.emailApplicationUpdates ?? true,
          emailJobAlerts: pref?.emailJobAlerts ?? true,
          emailProductNews: pref?.emailProductNews ?? false,
        }}
      />

      <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="exportar">
        <h2 id="exportar" className="flex items-center gap-2 font-semibold text-petroleum"><Download className="size-4" aria-hidden /> Baixar uma cópia dos seus dados</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Arquivo JSON com perfil, experiências, candidaturas, histórico, alertas, consentimentos e solicitações. Currículos são baixados individualmente.
        </p>
        <a href="/api/conta/exportar" className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium hover:bg-muted" download>
          <Download className="size-4" aria-hidden /> Exportar meus dados (JSON)
        </a>
      </section>

      <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="solicitacoes">
        <h2 id="solicitacoes" className="flex items-center gap-2 font-semibold text-petroleum"><FileLock2 className="size-4" aria-hidden /> Solicitações à equipe de privacidade</h2>
        <p className="mt-1 text-sm text-muted-foreground">Para pedidos que não podem ser feitos automaticamente aqui (ex.: informação sobre compartilhamentos, oposição a um tratamento).</p>
        {requests.length > 0 && (
          <ul className="mt-4 divide-y rounded-lg border">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{PRIVACY_REQUEST_LABEL[r.type]}</p>
                  <p className="text-xs text-muted-foreground">Protocolo {r.protocol} · aberta em {formatDate(r.createdAt)} · prazo {formatDate(r.dueAt)}</p>
                  {r.response && <p className="mt-1 text-sm">Resposta: {r.response}</p>}
                </div>
                <StatusBadge tone={STATUS[r.status][0]}>{STATUS[r.status][1]}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4"><PrivacyRequestForm name={user.name} email={user.email} /></div>
      </section>

      <section className="rounded-2xl border border-destructive/30 bg-card p-5 sm:p-6" aria-labelledby="excluir">
        <h2 id="excluir" className="font-semibold text-destructive">Excluir conta</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Apagamos seu perfil, currículos, fotos, alertas e vagas salvas; candidaturas em andamento são retiradas e o
          recorte de dados enviado às empresas é removido da plataforma. Registros mínimos de segurança podem ser mantidos
          pelo prazo legal, desvinculados dos seus dados de contato. Empresas que já baixaram seu currículo são
          controladoras desses dados e devem ser contatadas diretamente.
        </p>
        <div className="mt-4 max-w-md"><DeleteAccountForm /></div>
      </section>
    </div>
  );
}
