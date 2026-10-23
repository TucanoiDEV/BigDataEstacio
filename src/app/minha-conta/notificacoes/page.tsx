import { Suspense } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { EmptyState, PageHeader, SectionSkeleton } from "@/components/common/states";
import { MarkAllReadButton } from "@/components/candidate/mark-all-read";
import { requireUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Notificações" };

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Notificações" description="Atualizações de candidaturas, alertas e avisos da sua conta." actions={<MarkAllReadButton />} />
      <Suspense fallback={<SectionSkeleton rows={6} />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const user = await requireUser({ returnTo: "/minha-conta/notificacoes", allowUnverified: true });
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const now = new Date();
  if (!items.length) return <EmptyState icon={Bell} title="Tudo em dia" description="Você não tem notificações." />;
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {items.map((n) => {
        const body = (
          <div className="flex gap-3 p-4">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", !n.readAt && "font-semibold")}>{n.title}{!n.readAt && <span className="sr-only"> (não lida)</span>}</p>
              <p className="text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatRelative(n.createdAt, now)}</p>
            </div>
          </div>
        );
        // Somente links internos (gerados pelo servidor) são renderizados.
        return <li key={n.id}>{n.link?.startsWith("/") ? <Link href={n.link} className="block hover:bg-muted/40">{body}</Link> : body}</li>;
      })}
    </ul>
  );
}
