import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Paginação acessível baseada em links (funciona sem JavaScript). */
export function PaginationLinks({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  const nums = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...nums].sort((a, b) => a - b);
  const item = "grid h-9 min-w-9 place-items-center rounded-lg border px-3 text-sm font-medium";
  return (
    <nav aria-label="Paginação" className="flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(item, "bg-card hover:bg-muted")} aria-label="Página anterior">
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      ) : null}
      {sorted.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - sorted[i - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
          <Link
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(item, p === page ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={cn(item, "bg-card hover:bg-muted")} aria-label="Próxima página">
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}
