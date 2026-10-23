import { Suspense } from "react";
import { Search, Users } from "lucide-react";
import { EmptyState, PageHeader, SectionSkeleton, StatusBadge } from "@/components/common/states";
import { UserControls } from "@/components/admin/controls";
import { requirePlatformAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Usuários" };

export default function AdminUsersPage(props: PageProps<"/admin/usuarios">) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description="Busque por e-mail exato ou parte do nome. Papéis de administração da plataforma só são concedidos via linha de comando (npm run admin:create), nunca pela interface."
      />
      <form method="get" role="search" className="flex max-w-lg gap-2">
        <label htmlFor="q-user" className="sr-only">Buscar usuário</label>
        <input id="q-user" name="q" placeholder="E-mail ou nome" className="h-9 flex-1 rounded-lg border bg-card px-3 text-sm" maxLength={120} />
        <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"><Search className="size-4" aria-hidden /> Buscar</button>
      </form>
      <Suspense fallback={<SectionSkeleton rows={6} />}>
        <List searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/admin/usuarios">["searchParams"] }) {
  const admin = await requirePlatformAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 120) : "";
  if (q.length < 3) return <EmptyState icon={Users} title="Digite ao menos 3 caracteres" description="Por minimização de dados, a lista completa de usuários não é exibida." />;
  const users = await db.user.findMany({
    where: { OR: [{ email: q.toLowerCase() }, { name: { contains: q, mode: "insensitive" } }], status: { not: "DELETED" } },
    take: 25,
    select: { id: true, name: true, email: true, status: true, platformRole: true, createdAt: true, emailVerifiedAt: true, mfaEnabledAt: true, _count: { select: { memberships: true, applications: true } } },
  });
  if (!users.length) return <EmptyState icon={Users} title="Nenhum usuário encontrado" />;
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {users.map((u) => (
        <li key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <p className="font-medium">{u.name} {u.platformRole === "PLATFORM_ADMIN" && <StatusBadge tone="violet">Admin</StatusBadge>}</p>
            <p className="text-muted-foreground">{u.email}</p>
            <p className="text-xs text-muted-foreground">
              Desde {formatDate(u.createdAt)} · {u.emailVerifiedAt ? "e-mail verificado" : "e-mail não verificado"} · MFA {u.mfaEnabledAt ? "ativo" : "inativo"} · {u._count.memberships} empresa(s) · {u._count.applications} candidatura(s)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge tone={u.status === "ACTIVE" ? "green" : "red"}>{u.status === "ACTIVE" ? "Ativo" : "Suspenso"}</StatusBadge>
            {u.id !== admin.id && <UserControls userId={u.id} status={u.status} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
