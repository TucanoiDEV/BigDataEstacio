import { Suspense } from "react";
import { PageHeader, SectionSkeleton } from "@/components/common/states";
import { InviteForm, MemberActions, RevokeInviteButton } from "@/components/company/members";
import { requireOrgPermission } from "@/server/auth/dal";
import { canManageRole } from "@/server/authz/permissions";
import { db } from "@/server/db";
import { ORG_ROLE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { ORG_ROLES } from "@/lib/validation/org";

export const metadata = { title: "Membros" };

export default function MembersPage(props: PageProps<"/empresa/[orgId]/membros">) {
  return (
    <div className="space-y-6">
      <PageHeader title="Membros da empresa" description="Cada pessoa acessa apenas os recursos permitidos pelo seu papel. Convites valem por 7 dias e só para o e-mail convidado." />
      <Suspense fallback={<SectionSkeleton rows={6} />}>
        <Content params={props.params} />
      </Suspense>
    </div>
  );
}

const ROLE_HELP = {
  OWNER: "Tudo, inclusive gerenciar proprietários.",
  ADMIN: "Perfil da empresa, membros, vagas e candidaturas.",
  RECRUITER: "Vagas e candidaturas.",
  VIEWER: "Somente leitura de vagas e candidaturas.",
};

async function Content({ params }: { params: PageProps<"/empresa/[orgId]/membros">["params"] }) {
  const { orgId } = await params;
  const access = await requireOrgPermission(orgId, "org.members.manage");
  const [members, invites] = await Promise.all([
    db.orgMembership.findMany({ where: { orgId }, orderBy: { createdAt: "asc" }, select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } } }),
    db.orgInvitation.findMany({ where: { orgId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  const assignable = ORG_ROLES.filter((r) => canManageRole(access.membership.role, r));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="font-semibold text-petroleum">Convidar pessoa</h2>
        <InviteForm orgId={orgId} roles={assignable.map((r) => ({ value: r, label: `${ORG_ROLE_LABEL[r]} — ${ROLE_HELP[r]}` }))} />
      </section>

      <section className="rounded-2xl border bg-card" aria-labelledby="lista-membros">
        <h2 id="lista-membros" className="border-b px-5 py-4 font-semibold text-petroleum">Membros ({members.length})</h2>
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{m.user.name} {m.user.id === access.user.id && <span className="text-xs text-muted-foreground">(você)</span>}</p>
                <p className="truncate text-sm text-muted-foreground">{m.user.email} · desde {formatDate(m.createdAt)}</p>
              </div>
              <MemberActions
                orgId={orgId}
                membershipId={m.id}
                role={m.role}
                isSelf={m.user.id === access.user.id}
                editable={m.user.id !== access.user.id && canManageRole(access.membership.role, m.role)}
                roles={assignable.map((r) => ({ value: r, label: ORG_ROLE_LABEL[r] }))}
              />
            </li>
          ))}
        </ul>
      </section>

      {invites.length > 0 && (
        <section className="rounded-2xl border bg-card" aria-labelledby="convites">
          <h2 id="convites" className="border-b px-5 py-4 font-semibold text-petroleum">Convites pendentes</h2>
          <ul className="divide-y">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>{i.email} · {ORG_ROLE_LABEL[i.role]} · expira em {formatDate(i.expiresAt)}</span>
                <RevokeInviteButton orgId={orgId} invitationId={i.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
