"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Briefcase, Building2, LogIn, Menu, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/vagas", label: "Explorar vagas", icon: Briefcase },
  { href: "/mercado-de-trabalho", label: "Mercado de trabalho", icon: BarChart3 },
  { href: "/empresas", label: "Empresas", icon: Building2 },
] as const;

type IsActive = (href: string) => boolean;
const never: IsActive = () => false;

function useIsActive(): IsActive {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

function WithActive({ render }: { render: (isActive: IsActive) => React.ReactNode }) {
  return <>{render(useIsActive())}</>;
}

/** usePathname é dinâmico: o fallback sem destaque fica no shell estático. */
function ActiveAware({ render }: { render: (isActive: IsActive) => React.ReactNode }) {
  return (
    <Suspense fallback={render(never)}>
      <WithActive render={render} />
    </Suspense>
  );
}

export function MainNav() {
  return <ActiveAware render={(isActive) => <MainNavList isActive={isActive} />} />;
}

export function MobileNav() {
  return <ActiveAware render={(isActive) => <MobileNavSheet isActive={isActive} />} />;
}

function MainNavList({ isActive }: { isActive: IsActive }) {
  return (
    <nav aria-label="Principal" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive(l.href) && "bg-secondary text-secondary-foreground",
              )}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function MobileNavSheet({ isActive }: { isActive: IsActive }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Logo />
        </SheetHeader>
        <nav aria-label="Menu móvel" className="px-4">
          <ul className="space-y-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <SheetClose asChild>
                  <Link
                    href={l.href}
                    aria-current={isActive(l.href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted",
                      isActive(l.href) && "bg-secondary text-secondary-foreground",
                    )}
                  >
                    <l.icon className="size-4" aria-hidden />
                    {l.label}
                  </Link>
                </SheetClose>
              </li>
            ))}
            <li className="pt-3">
              <SheetClose asChild>
                <Link href="/entrar" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted">
                  <LogIn className="size-4" aria-hidden /> Entrar
                </Link>
              </SheetClose>
            </li>
            <li>
              <SheetClose asChild>
                <Link href="/criar-conta" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted">
                  <UserPlus className="size-4" aria-hidden /> Criar conta
                </Link>
              </SheetClose>
            </li>
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
