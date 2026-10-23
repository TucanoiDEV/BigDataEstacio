"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SideNavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

/** Navegação lateral (desktop) que vira faixa rolável horizontal no celular. */
export function SideNav(props: { items: SideNavItem[]; label: string }) {
  // usePathname é dinâmico em rotas com parâmetros: o fallback (sem destaque) entra no shell estático.
  return (
    <Suspense fallback={<SideNavList {...props} pathname={null} />}>
      <SideNavWithPath {...props} />
    </Suspense>
  );
}

function SideNavWithPath(props: { items: SideNavItem[]; label: string }) {
  return <SideNavList {...props} pathname={usePathname()} />;
}

function SideNavList({ items, label, pathname }: { items: SideNavItem[]; label: string; pathname: string | null }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((item) => {
          const active = pathname !== null && (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
