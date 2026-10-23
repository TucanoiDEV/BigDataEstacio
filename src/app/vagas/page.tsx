import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BellPlus, Search, SearchX } from "lucide-react";
import { CardListSkeleton, EmptyState } from "@/components/common/states";
import { PaginationLinks } from "@/components/common/pagination-links";
import { JobCard } from "@/components/jobs/job-card";
import { JobFilters } from "@/components/jobs/job-filters";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/server/auth/dal";
import { searchJobs } from "@/server/services/search";
import { savedJobIds } from "@/server/services/saved-and-alerts";
import { formatNumber } from "@/lib/format";
import { jobSearchToParams, parseJobSearch } from "@/lib/validation/search";

export const metadata: Metadata = {
  title: "Explorar vagas",
  description: "Busque vagas de empresas verificadas por cargo, empresa, cidade, UF, salário, senioridade e modalidade de trabalho.",
};

export default function JobsPage(props: PageProps<"/vagas">) {
  return (
    <div className="container-page py-8 lg:py-10">
      <div className="mb-6 rounded-2xl border bg-card p-5 sm:p-7">
        <h1 className="text-2xl font-bold text-petroleum sm:text-3xl">Encontre a vaga certa para você</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas as vagas são publicadas por empresas verificadas e passam por moderação contra golpes.
        </p>
        <Suspense fallback={<Skeleton className="mt-5 h-12 w-full" />}>
          <SearchBar searchParams={props.searchParams} />
        </Suspense>
      </div>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchBar({ searchParams }: { searchParams: PageProps<"/vagas">["searchParams"] }) {
  const filters = parseJobSearch(await searchParams);
  const keep = jobSearchToParams({ ...filters, q: undefined, pagina: undefined });
  return (
    <form action="/vagas" method="get" role="search" className="mt-5 flex flex-col gap-2 sm:flex-row">
      <label htmlFor="busca-q" className="sr-only">Cargo, empresa ou palavra-chave</label>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id="busca-q"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Cargo, empresa ou palavra-chave"
          className="h-12 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          maxLength={100}
        />
      </div>
      {[...keep.entries()].map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className="h-12 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
        Buscar
      </button>
    </form>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/vagas">["searchParams"] }) {
  const filters = parseJobSearch(await searchParams);
  const [result, user] = await Promise.all([searchJobs(filters), getCurrentUser()]);
  const now = new Date();
  const saved = user ? await savedJobIds(user.id, result.jobs.map((j) => j.id)) : new Set<string>();
  const hrefFor = (p: number) => {
    const params = jobSearchToParams({ ...filters, pagina: p });
    return `/vagas${params.size ? `?${params}` : ""}`;
  };
  const alertParams = jobSearchToParams({ ...filters, pagina: undefined, ordem: undefined });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside>
        <JobFilters key={JSON.stringify(filters)} filters={filters} />
      </aside>
      <section aria-labelledby="resultados">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="resultados" className="text-base font-semibold" aria-live="polite">
            {result.total === 0 ? "Nenhuma vaga encontrada" : (
              <>Mostrando <span className="text-primary">{formatNumber(result.total)}</span> {result.total === 1 ? "vaga disponível" : "vagas disponíveis"}</>
            )}
          </h2>
          {user && alertParams.size > 0 && (
            <Link
              href={`/minha-conta/alertas?${alertParams}`}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium text-petroleum hover:bg-muted"
            >
              <BellPlus className="size-4" aria-hidden /> Criar alerta com esta busca
            </Link>
          )}
        </div>
        {result.jobs.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Nenhuma vaga corresponde aos filtros"
            description="Tente remover alguns filtros, buscar por termos mais amplos ou criar um alerta para ser avisado(a) quando surgirem vagas."
            action={{ href: "/vagas", label: "Limpar filtros" }}
          />
        ) : (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.jobs.map((job) => (
                <JobCard key={job.id} job={job} now={now} canSave={Boolean(user)} saved={saved.has(job.id)} />
              ))}
            </div>
            <PaginationLinks page={result.page} pages={result.pages} hrefFor={hrefFor} />
          </div>
        )}
      </section>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <Skeleton className="h-[36rem] w-full rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-56" />
        <CardListSkeleton count={6} />
      </div>
    </div>
  );
}
