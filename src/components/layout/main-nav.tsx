"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Briefcase, Building2, FileText, Heart, LayoutDashboard, LogIn, LogOut, Menu, Plus, Shield, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import { logoutAction } from "@/app/actions/auth";
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

/** Conta para o menu móvel: null = visitante; undefined = sessão ainda carregando (sem links de conta). */
export type MobileAccount = { name: string; isAdmin: boolean; orgs: { id: string; tradeName: string }[] } | null;

export function MobileNav({ account }: { account?: MobileAccount }) {
  return <ActiveAware render={(isActive) => <MobileNavSheet isActive={isActive} account={account} />} />;
}

const itemCls = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted";

function SheetLink({ href, icon: Icon, children, isActive }: { href: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; isActive: IsActive }) {
  return (
    <li>
      <SheetClose asChild>
        <Link href={href} aria-current={isActive(href) ? "page" : undefined} className={cn(itemCls, isActive(href) && "bg-secondary text-secondary-foreground")}>
          <Icon className="size-4" aria-hidden />
          {children}
        </Link>
      </SheetClose>
    </li>
  );
}

function AccountSection({ account, isActive }: { account: MobileAccount; isActive: IsActive }) {
  if (!account) {
    return (
      <>
        <SheetLink href="/entrar" icon={LogIn} isActive={isActive}>Entrar</SheetLink>
        <SheetLink href="/criar-conta" icon={UserPlus} isActive={isActive}>Criar conta</SheetLink>
      </>
    );
  }
  return (
    <>
      <li className="px-3 pb-1 text-xs font-semibold text-muted-foreground">Olá, {account.name.split(" ")[0]}</li>
      <SheetLink href="/minha-conta" icon={LayoutDashboard} isActive={isActive}>Minha conta</SheetLink>
      <SheetLink href="/minha-conta/candidaturas" icon={FileText} isActive={isActive}>Candidaturas</SheetLink>
      <SheetLink href="/minha-conta/favoritas" icon={Heart} isActive={isActive}>Vagas salvas</SheetLink>
      <SheetLink href="/minha-conta/notificacoes" icon={Bell} isActive={isActive}>Notificações</SheetLink>
      <li className="px-3 pb-1 pt-3 text-xs font-semibold text-muted-foreground">Empresas</li>
      {account.orgs.map((o) => (
        <SheetLink key={o.id} href={`/empresa/${o.id}`} icon={Building2} isActive={isActive}>
          <span className="truncate">{o.tradeName}</span>
        </SheetLink>
      ))}
      <SheetLink href="/empresa/nova" icon={Plus} isActive={isActive}>Cadastrar empresa</SheetLink>
      {account.isAdmin && <SheetLink href="/admin" icon={Shield} isActive={isActive}>Administração</SheetLink>}
      <li className="pt-3">
        <form action={logoutAction}>
          <button type="submit" className={cn(itemCls, "w-full text-left")}>
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </form>
      </li>
    </>
  );
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

function MobileNavSheet({ isActive, account }: { isActive: IsActive; account?: MobileAccount }) {
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
          </ul>
          {account !== undefined && (
            <ul className="mt-3 space-y-1 border-t pt-3">
              <AccountSection account={account} isActive={isActive} />
            </ul>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
