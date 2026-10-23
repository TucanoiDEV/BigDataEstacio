import Link from "next/link";
import { Bell } from "lucide-react";
import { getCurrentUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { AuthLinks } from "@/components/layout/site-header";
import { UserMenuDropdown } from "@/components/layout/user-menu-dropdown";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return <AuthLinks />;

  const [unread, memberships] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.orgMembership.findMany({
      where: { userId: user.id },
      select: { org: { select: { id: true, tradeName: true } } },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
  ]);

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/minha-conta/notificacoes"
        className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={unread > 0 ? `Notificações: ${unread} não lidas` : "Notificações"}
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
      <UserMenuDropdown
        name={user.name}
        email={user.email}
        isAdmin={user.platformRole === "PLATFORM_ADMIN"}
        orgs={memberships.map((m) => m.org)}
      />
    </div>
  );
}
