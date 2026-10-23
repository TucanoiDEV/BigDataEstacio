import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Database, Info, Scale } from "lucide-react";
import { EmptyState, SectionSkeleton } from "@/components/common/states";
import { BalanceChart, DivergingList, FlowsChart, UnemploymentChart } from "@/components/charts/observatory-charts";
import { UfMap } from "@/components/charts/uf-map";
import { TerritoryFilter } from "@/components/observatory/territory-filter";
import { SourceNote } from "@/components/observatory/source-note";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPublishedDatasets,
  listMunicipalities,
  listUfs,
  monthlySeries,
  municipalityRanking,
  occupationBreakdown,
  resolveTerritory,
  sectorBreakdown,
  ufComparison,
  unemploymentSeries,
  wageBySector,
} from "@/server/services/observatory";
import { buildUfMap } from "@/server/services/geo";
import { formatCurrency, formatMonth, formatNumber, formatSigned } from "@/lib/format";

export const metadata: Metadata = {
  title: "Observatório do mercado de trabalho",
  description: "Admissões, desligamentos e saldo do emprego formal (Novo CAGED) e taxa de desocupação (PNAD Contínua/IBGE) por Brasil, UF e município, com fonte e metodologia.",
};

type SP = PageProps<"/mercado-de-trabalho">["searchParams"];

export default function ObservatoryPage(props: PageProps<"/mercado-de-trabalho">) {
  return (
    <>
      <section className="hero-pattern text-white">
        <div className="container-page py-10 lg:py-14">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Observatório do trabalho</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold sm:text-4xl">O mercado de trabalho formal em dados oficiais</h1>
          <p className="mt-3 max-w-3xl text-petroleum-foreground/85">
            Movimentações de emprego com carteira assinada (Novo CAGED/MTE) e desocupação (PNAD Contínua/IBGE), por Brasil, UF e município.
          </p>
          <div className="mt-5 flex max-w-3xl gap-3 rounded-xl bg-white/10 p-4 text-sm">
            <Info className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden />
            <p>
              Estes números <strong>não são vagas anunciadas</strong> no Emprego Agora. O Novo CAGED registra admissões e desligamentos já
              realizados; a PNAD estima a desocupação por amostra domiciliar. Cada indicador traz fonte, período de referência e metodologia.{" "}
              <Link href="/mercado-de-trabalho/metodologia" className="font-semibold text-white underline">Ver metodologia</Link>
            </p>
          </div>
        </div>
      </section>
      <div className="container-page space-y-6 py-8">
        <Suspense fallback={<Skeleton className="h-20 w-full rounded-2xl" />}>
          <Filters searchParams={props.searchParams} />
        </Suspense>
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard searchParams={props.searchParams} />
        </Suspense>
      </div>
    </>
  );
}

function param(v: string | string[] | undefined) {
  return typeof v === "string" ? v : undefined;
}

async function Filters({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const uf = param(sp.uf);
  const mun = param(sp.mun);
  const [ufs, muns] = await Promise.all([listUfs(), uf ? listMunicipalities(uf) : Promise.resolve([])]);
  if (ufs.length === 0) return null;
  const validUf = ufs.some((u) => u.code === uf) ? uf! : null;
  return (
    <div className="rounded-2xl border bg-card p-5">
      <TerritoryFilter key={`${validUf}-${mun}`} ufs={ufs} municipalities={muns} uf={validUf} mun={validUf && mun ? mun : null} />
    </div>
  );
}

async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { caged, pnad } = await getPublishedDatasets();

  if (!caged && !pnad) {
    return (
      <EmptyState
        icon={Database}
        title="Nenhum conjunto de dados oficial publicado ainda"
        description={
          <>
            O observatório só exibe dados importados das fontes oficiais e aprovados pela administração. Para importar, use o pipeline em
            <code className="mx-1 rounded bg-muted px-1">data-pipeline/</code> (veja docs/FONTES-DE-DADOS.md) e publique o conjunto no painel administrativo.
          </>
        }
        action={{ href: "/mercado-de-trabalho/metodologia", label: "Conhecer as fontes" }}
      />
    );
  }

  const territory = await resolveTerritory(param(sp.uf), param(sp.mun));

  return (
    <div className="space-y-6">
      {caged ? <CagedSection datasetId={caged.id} territory={territory} /> : (
        <EmptyState icon={Database} title="Dados do Novo CAGED não publicados" description="Indicadores de admissões, desligamentos e saldo aparecerão aqui após a importação e publicação." />
      )}
      {pnad && <PnadSection territoryName={territory.level === "BR" ? null : territory.name} ufCode={territory.ufCode} />}
    </div>
  );
}

async function CagedSection({ datasetId, territory }: { datasetId: string; territory: Awaited<ReturnType<typeof resolveTerritory>> }) {
  const { caged } = await getPublishedDatasets();
  if (!caged || caged.id !== datasetId) return null;
  const series = await monthlySeries(caged, territory);
  if (series.length === 0) {
    return <EmptyState icon={Database} title={`Sem movimentações registradas para ${territory.name} no período`} description="Territórios sem movimentação declarada não aparecem na base agregada." />;
  }
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const sum12 = series.reduce((acc, p) => ({ adm: acc.adm + p.admissions, sep: acc.sep + p.separations, bal: acc.bal + p.balance }), { adm: 0, sep: 0, bal: 0 });
  const periodLabel = `${formatMonth(series[0].period)} a ${formatMonth(last.period)}`;
  const isMun = territory.level === "MUNICIPALITY";

  const [sectors, occupations, ufs, ranking, wages] = await Promise.all([
    sectorBreakdown(caged, territory),
    occupationBreakdown(caged, territory),
    ufComparison(caged),
    territory.level === "UF" ? municipalityRanking(caged, territory.code) : Promise.resolve(null),
    wageBySector(caged, territory, new Date(`${last.period}T00:00:00Z`)),
  ]);
  const map = await buildUfMap(ufs);

  const kpis = [
    { label: `Admissões em ${formatMonth(last.period)}`, value: formatNumber(last.admissions), delta: prev ? last.admissions - prev.admissions : null },
    { label: `Desligamentos em ${formatMonth(last.period)}`, value: formatNumber(last.separations), delta: prev ? last.separations - prev.separations : null },
    { label: `Saldo em ${formatMonth(last.period)}`, value: formatSigned(last.balance), delta: prev ? last.balance - prev.balance : null, tone: last.balance >= 0 ? "pos" : "neg" },
    { label: `Saldo acumulado (${series.length} meses)`, value: formatSigned(sum12.bal), delta: null, tone: sum12.bal >= 0 ? "pos" : "neg" },
  ];

  return (
    <section aria-labelledby="caged-title" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="caged-title" className="text-xl font-bold text-petroleum">Emprego formal — {territory.name}</h2>
          <p className="text-sm text-muted-foreground">Novo CAGED · {periodLabel} · dados com ajustes</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className={`mt-2 text-3xl font-bold tabular-nums ${k.tone === "neg" ? "text-[var(--chart-neg)]" : "text-petroleum"}`}>{k.value}</p>
            {k.delta !== null && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                {k.delta >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
                {formatSigned(k.delta)} em relação ao mês anterior
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <FlowsChart data={series} territory={territory.name} />
        <BalanceChart data={series} territory={territory.name} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {map ? <UfMap shapes={map.shapes} viewBox={map.viewBox} bins={map.bins} selected={territory.ufCode} period={periodLabel} /> : null}
        {ranking ? (
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="font-semibold text-petroleum">Municípios com maior saldo — {territory.name}</h3>
            <p className="text-xs text-muted-foreground">Acumulado de {periodLabel} · {ranking.count} municípios com movimentação</p>
            <ol className="mt-3 divide-y text-sm">
              {ranking.top.map((m, i) => (
                <li key={m.code} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/mercado-de-trabalho?uf=${territory.code}&mun=${m.code}`} className="truncate hover:underline">{i + 1}. {m.name}</Link>
                  <span className="font-semibold tabular-nums">{formatSigned(m.balance)}</span>
                </li>
              ))}
            </ol>
            {ranking.bottom.length > 0 && (
              <>
                <h4 className="mt-4 text-sm font-semibold">Maiores saldos negativos</h4>
                <ul className="mt-1 divide-y text-sm">
                  {ranking.bottom.map((m) => (
                    <li key={m.code} className="flex justify-between gap-3 py-2"><span className="truncate">{m.name}</span><span className="tabular-nums text-[var(--chart-neg)]">{formatSigned(m.balance)}</span></li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-5 text-sm">
            <h3 className="flex items-center gap-2 font-semibold text-petroleum"><Scale className="size-4" aria-hidden /> Movimentação acumulada — {territory.name}</h3>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div><dt className="text-xs text-muted-foreground">Admissões</dt><dd className="text-lg font-bold">{formatNumber(sum12.adm)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Desligamentos</dt><dd className="text-lg font-bold">{formatNumber(sum12.sep)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Saldo</dt><dd className="text-lg font-bold">{formatSigned(sum12.bal)}</dd></div>
            </dl>
            <p className="mt-4 text-muted-foreground">
              {isMun
                ? "Para municípios são publicados apenas os totais (sem recorte por setor ou ocupação), o que preserva a robustez estatística dos números."
                : "Selecione uma UF no filtro ou no mapa para ver o ranking de municípios."}
            </p>
          </div>
        )}
      </div>

      {!isMun && (
        <div className="grid gap-6 xl:grid-cols-2">
          <DivergingList title="Saldo por setor de atividade (seção CNAE 2.0)" subtitle={`Acumulado ${periodLabel}`} items={sectors} />
          <DivergingList title="Saldo por grande grupo de ocupação (CBO 2002)" subtitle={`Acumulado ${periodLabel}`} items={occupations} />
        </div>
      )}

      {!isMun && (
        <section className="rounded-2xl border bg-card p-5" aria-labelledby="salarios">
          <h3 id="salarios" className="font-semibold text-petroleum">Salário mediano de admissão por setor — {formatMonth(last.period)}</h3>
          <p className="text-xs text-muted-foreground">
            Mediana do salário contratual de admissão (mensalistas, não intermitentes, entre 0,3 e 150 salários mínimos). Exibido somente com ao
            menos 30 admissões válidas no recorte. Total do território: {last.wage ? formatCurrency(last.wage) : "amostra insuficiente"}.
          </p>
          {wages.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Amostra insuficiente para estimativas por setor neste recorte.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th scope="col" className="py-2">Setor</th><th scope="col" className="py-2 text-right">Mediana</th><th scope="col" className="py-2 text-right">Admissões válidas</th></tr>
                </thead>
                <tbody className="divide-y">
                  {wages.map((w) => (
                    <tr key={w.code}><td className="py-1.5">{w.title}</td><td className="py-1.5 text-right font-medium tabular-nums">{formatCurrency(w.wage)}</td><td className="py-1.5 text-right tabular-nums text-muted-foreground">{formatNumber(w.n)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <SourceNote dataset={caged} />
    </section>
  );
}

async function PnadSection({ territoryName, ufCode }: { territoryName: string | null; ufCode: string | null }) {
  const { pnad } = await getPublishedDatasets();
  if (!pnad) return null;
  const series = await unemploymentSeries(pnad, ufCode);
  if (!series.length) return null;
  const ufName = ufCode ? (territoryName?.replace(/ \(.+\)$/, "") ?? null) : null;
  return (
    <section aria-labelledby="pnad-title" className="space-y-4">
      <h2 id="pnad-title" className="text-xl font-bold text-petroleum">Desocupação {ufName ? `— Brasil e ${ufName}` : "— Brasil"}</h2>
      {ufCode && territoryName?.includes("(") && (
        <p className="text-sm text-muted-foreground">A PNAD Contínua não é divulgada por município nesta tabela; exibimos a UF do município selecionado.</p>
      )}
      <UnemploymentChart data={series} ufName={ufName} />
      <SourceNote dataset={pnad} />
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      <div className="grid gap-6 xl:grid-cols-2"><SectionSkeleton rows={8} /><SectionSkeleton rows={8} /></div>
    </div>
  );
}
