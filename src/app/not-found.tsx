import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container-page flex flex-1 flex-col items-center justify-center py-20 text-center">
      <SearchX className="size-12 text-primary" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold text-petroleum">Página não encontrada</h1>
      <p className="mt-2 max-w-md text-muted-foreground">O endereço pode estar incorreto, a vaga pode ter sido encerrada ou você não tem acesso a este conteúdo.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="inline-flex h-10 items-center rounded-lg border bg-card px-4 text-sm font-medium hover:bg-muted">Início</Link>
        <Link href="/vagas" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Explorar vagas</Link>
      </div>
    </div>
  );
}
