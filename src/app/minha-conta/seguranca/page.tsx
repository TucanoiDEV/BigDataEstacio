import { Suspense } from "react";
import { Monitor, ShieldAlert } from "lucide-react";
import { PageHeader, SectionSkeleton } from "@/components/common/states";
import { ChangePasswordForm, MfaManager, RevokeSessionButton } from "@/components/candidate/security-forms";
import { requireUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Segurança" };

export default function SecurityPage(props: PageProps<"/minha-conta/seguranca">) {
  return (
    <div className="space-y-6">
      <PageHeader title="Segurança da conta" description="Senha, verificação em duas etapas e dispositivos conectados." />
      <Suspense fallback={<SectionSkeleton rows={8} />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function describeAgent(ua: string | null) {
  if (!ua) return "Dispositivo desconhecido";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return `${browser}${os ? ` em ${os}` : ""}`;
}

async function Content({ searchParams }: { searchParams: PageProps<"/minha-conta/seguranca">["searchParams"] }) {
  const sp = await searchParams;
  const user = await requireUser({ returnTo: "/minha-conta/seguranca", allowUnverified: true });
  const [sessions, recoveryLeft] = await Promise.all([
    db.session.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" }, select: { id: true, createdAt: true, lastSeenAt: true, userAgent: true } }),
    db.mfaRecoveryCode.count({ where: { userId: user.id, usedAt: null } }),
  ]);
  const adminMustEnable = user.platformRole === "PLATFORM_ADMIN" && env().requireAdminMfa && !user.mfaEnabledAt;

  return (
    <div className="space-y-6">
      {(sp.mfa === "obrigatorio" || adminMustEnable) && (
        <div role="alert" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <ShieldAlert className="size-5 shrink-0" aria-hidden />
          A área administrativa exige verificação em duas etapas. Ative-a abaixo para continuar.
        </div>
      )}
      <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="mfa">
        <h2 id="mfa" className="font-semibold text-petroleum">Verificação em duas etapas (MFA)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Aegis, 1Password…) para gerar códigos de 6 dígitos.
        </p>
        <div className="mt-4">
          <MfaManager enabled={Boolean(user.mfaEnabledAt)} recoveryLeft={recoveryLeft} />
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="senha">
        <h2 id="senha" className="font-semibold text-petroleum">Alterar senha</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ao alterar, todas as outras sessões são encerradas.</p>
        <div className="mt-4 max-w-md"><ChangePasswordForm /></div>
      </section>

      <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="sessoes">
        <h2 id="sessoes" className="font-semibold text-petroleum">Sessões ativas</h2>
        <ul className="mt-3 divide-y">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <Monitor className="size-5 text-muted-foreground" aria-hidden />
                <div>
                  <p className="text-sm font-medium">{describeAgent(s.userAgent)} {s.id === user.sessionId && <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">esta sessão</span>}</p>
                  <p className="text-xs text-muted-foreground">Início: {formatDateTime(s.createdAt)} · Última atividade: {formatDateTime(s.lastSeenAt)}</p>
                </div>
              </div>
              {s.id !== user.sessionId && <RevokeSessionButton sessionId={s.id} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
