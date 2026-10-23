import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { MainNav, MobileNav } from "@/components/layout/main-nav";
import { UserMenu } from "@/components/layout/user-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <div className="container-page flex h-16 items-center gap-6">
        <Logo />
        <MainNav />
        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={<Skeleton className="h-9 w-40" />}>
            <UserMenu />
          </Suspense>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}

export function AuthLinks() {
  return (
    <div className="hidden items-center gap-2 sm:flex">
      <Link href="/entrar" className="rounded-lg px-3 py-2 text-sm font-medium text-petroleum hover:bg-muted">
        Entrar
      </Link>
      <Link
        href="/criar-conta"
        className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        Criar conta
      </Link>
    </div>
  );
}
