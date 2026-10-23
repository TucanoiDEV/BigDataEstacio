import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  Briefcase,
  Building2,
  Eye,
  KanbanSquare,
  Lock,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { CardListSkeleton, EmptyState } from "@/components/common/states";
import { JobCard } from "@/components/jobs/job-card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/server/db";
import { headlineBalance } from "@/server/services/observatory";
import { jobCardSelect, trendingSectors } from "@/server/services/search";
import { publicJobWhere } from "@/server/services/jobs";
import { SECTORS, UFS, WORK_MODEL_LABEL } from "@/lib/constants";
import { formatMonth, formatNumber, formatSigned } from "@/lib/format";

const field = "h-12 w-full rounded-xl border-0 bg-white px-3 text-sm text-foreground outline-none ring-1 ring-white/20 focus-visible:ring-3 focus-visible:ring-emerald-300";

export default function HomePage() {
  return (
    <>
      <section className="hero-pattern text-white">
        <div className="container-page grid grid-cols-1 gap-10 py-14 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-200">
              <BadgeCheck className="size-3.5" aria-hidden /> Vagas de empresas verificadas
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
              Sua próxima oportunidade <span className="text-emerald-300">começa aqui</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-petroleum-foreground/85">
              Encontre vagas, acompanhe cada etapa das suas candidaturas e entenda o mercado de trabalho com dados oficiais.
            </p>
            <form action="/vagas" method="get" role="search" className="mt-8 grid grid-cols-1 gap-2 rounded-2xl bg-white/10 p-2 backdrop-blur sm:grid-cols-[1.2fr_1fr_1.15fr_auto]">
              <div className="relative">
                <label htmlFor="home-q" className="sr-only">Cargo ou empresa</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input id="home-q" name="q" placeholder="Cargo ou empresa" className={`${field} pl-9`} maxLength={100} />
              </div>
              <div>
                <label htmlFor="home-uf" className="sr-only">Localização</label>
                <select id="home-uf" name="uf" className={field} defaultValue="">
                  <option value="">Todo o Brasil</option>
                  {UFS.map((u) => <option key={u.code} value={u.code}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="home-mod" className="sr-only">Modalidade</label>
                <select id="home-mod" name="modalidade" className={field} defaultValue="">
                  <option value="">Qualquer modalidade</option>
                  {Object.entries(WORK_MODEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <button type="submit" className="h-12 rounded-xl bg-emerald-500 px-6 text-sm font-bold text-petroleum transition hover:bg-emerald-400">
                Buscar vagas
              </button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="text-petroleum-foreground/70">Atalhos:</span>
              {[
                { href: "/vagas?modalidade=REMOTE", label: "Remoto" },
                { href: "/vagas?contrato=INTERNSHIP", label: "Estágio" },
                { href: "/vagas?contrato=CLT", label: "CLT" },
                { href: "/vagas?senioridade=JUNIOR", label: "Júnior" },
              ].map((c) => (
                <Link key={c.href} href={c.href} className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20">{c.label}</Link>
              ))}
            </div>
          </div>
          <Suspense fallback={<Skeleton className="h-72 w-full rounded-3xl bg-white/10" />}>
            <HeroPanel />
          </Suspense>
        </div>
      </section>

      <section className="container-page py-14" aria-labelledby="recentes">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 id="recentes" className="text-2xl font-bold text-petroleum">Oportunidades recentes</h2>
            <p className="text-sm text-muted-foreground">Publicadas por empresas verificadas e revisadas contra golpes.</p>
          </div>
          <Link href="/vagas" className="hidden items-center gap-1 text-sm font-semibold text-primary hover:underline sm:inline-flex">
            Ver todas <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <Suspense fallback={<CardListSkeleton count={6} />}>
          <RecentJobs />
        </Suspense>
      </section>

      <section className="border-y bg-card" aria-labelledby="areas">
        <div className="container-page py-14">
          <h2 id="areas" className="flex items-center gap-2 text-2xl font-bold text-petroleum"><TrendingUp className="size-6 text-primary" aria-hidden /> Áreas em alta</h2>
          <p className="mb-6 text-sm text-muted-foreground">Setores com mais vagas abertas na plataforma agora.</p>
          <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
            <TrendingAreas />
          </Suspense>
        </div>
      </section>

      <section className="container-page grid grid-cols-1 gap-8 py-14 lg:grid-cols-2 lg:items-center" aria-labelledby="observatorio">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Observatório do trabalho</p>
          <h2 id="observatorio" className="mt-2 text-3xl font-bold text-petroleum">Decida com dados oficiais, não com achismo</h2>
          <p className="mt-3 text-muted-foreground">
            Acompanhe admissões, desligamentos e o saldo do emprego formal (Novo CAGED), a desocupação (PNAD Contínua/IBGE) e compare UFs,
            municípios, setores e ocupações. Toda informação traz fonte, data de referência e metodologia.
          </p>
          <Link href="/mercado-de-trabalho" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-petroleum px-5 text-sm font-semibold text-white hover:opacity-90">
            <BarChart3 className="size-4" aria-hidden /> Explorar o mercado de trabalho
          </Link>
        </div>
        <Suspense fallback={<Skeleton className="h-56 w-full rounded-2xl" />}>
          <ObservatoryTeaser />
        </Suspense>
      </section>

      <section className="bg-secondary/60" aria-labelledby="empresas">
        <div className="container-page grid grid-cols-1 gap-8 py-14 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          <div>
            <h2 id="empresas" className="text-3xl font-bold text-petroleum">Para empresas que contratam com responsabilidade</h2>
            <p className="mt-3 text-muted-foreground">Publique vagas, organize candidaturas por etapa e trabalhe em equipe com permissões por papel.</p>
            <Link href="/empresa/nova" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <Building2 className="size-4" aria-hidden /> Cadastrar minha empresa
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: BadgeCheck, title: "Verificação", text: "CNPJ e domínio conferidos antes da primeira vaga." },
              { icon: KanbanSquare, title: "Etapas claras", text: "Enviada, em análise, entrevista e decisão — com o candidato sempre informado." },
              { icon: Lock, title: "Dados protegidos", text: "Acesso só às candidaturas da sua empresa, com registro de auditoria." },
            ].map((f) => (
              <li key={f.title} className="rounded-2xl border bg-card p-5">
                <f.icon className="size-6 text-primary" aria-hidden />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-14" aria-labelledby="confianca">
        <h2 id="confianca" className="text-center text-2xl font-bold text-petroleum">Privacidade e segurança desde o início</h2>
        <ul className="mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-3">
          {[
            { icon: Eye, title: "Você controla seus dados", text: "Visibilidade do perfil, compartilhamento de contato por candidatura, exportação e exclusão.", href: "/central-de-privacidade" },
            { icon: Sparkles, title: "Recomendações explicáveis", text: "Mostramos por que uma vaga combina com você. Nenhuma decisão automática sobre candidatos.", href: "/privacidade#recomendacoes" },
            { icon: ShieldCheck, title: "Segurança real", text: "Senhas com Argon2id, verificação em duas etapas, sessões revogáveis e moderação contra golpes.", href: "/seguranca" },
          ].map((f) => (
            <li key={f.title}>
              <Link href={f.href} className="block h-full rounded-2xl border bg-card p-6 hover:border-primary/40 hover:shadow-sm">
                <f.icon className="size-6 text-primary" aria-hidden />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

async function HeroPanel() {
  await connection();
  const now = new Date();
  const [jobs, orgs, cities] = await Promise.all([
    db.job.count({ where: publicJobWhere(now) }),
    db.organization.count({ where: { verificationStatus: "VERIFIED" } }),
    db.job.groupBy({ by: ["state"], where: { ...publicJobWhere(now), state: { not: null } } }),
  ]);
  const stats = [
    { icon: Briefcase, label: "Vagas abertas", value: formatNumber(jobs) },
    { icon: Building2, label: "Empresas verificadas", value: formatNumber(orgs) },
    { icon: MapPin, label: "UFs com vagas presenciais/híbridas", value: formatNumber(cities.length) },
  ];
  return (
    <div className="rounded-3xl bg-white/10 p-6 ring-1 ring-white/15 backdrop-blur">
      <p className="text-sm font-semibold text-emerald-200">Agora na plataforma</p>
      <ul className="mt-4 space-y-4">
        {stats.map((s) => (
          <li key={s.label} className="flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-white/10"><s.icon className="size-5 text-emerald-300" aria-hidden /></span>
            <span>
              <span className="block text-2xl font-bold">{s.value}</span>
              <span className="text-sm text-petroleum-foreground/80">{s.label}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-petroleum-foreground/70">Contagens em tempo real das vagas publicadas no Emprego Agora.</p>
    </div>
  );
}

async function RecentJobs() {
  await connection();
  const now = new Date();
  const jobs = await db.job.findMany({ where: publicJobWhere(now), orderBy: { publishedAt: "desc" }, take: 6, select: jobCardSelect });
  if (!jobs.length) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Ainda não há vagas publicadas"
        description="Assim que empresas verificadas publicarem vagas, elas aparecerão aqui. Crie um alerta para ser avisado(a)."
        action={{ href: "/criar-conta", label: "Criar conta e alerta" }}
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {jobs.map((j) => <JobCard key={j.id} job={j} now={now} />)}
    </div>
  );
}

async function TrendingAreas() {
  await connection();
  const trending = await trendingSectors(8);
  const items = trending.length ? trending : SECTORS.slice(0, 8).map((s) => ({ sector: s, count: null as number | null }));
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((t) => (
        <li key={t.sector}>
          <Link href={`/vagas?setor=${encodeURIComponent(t.sector)}`} className="flex items-center justify-between rounded-xl border bg-background px-4 py-3 text-sm hover:border-primary/40 hover:bg-secondary/50">
            <span className="font-medium">{t.sector}</span>
            {t.count !== null ? <span className="rounded-full bg-secondary px-2 text-xs font-semibold text-secondary-foreground">{t.count} vaga{t.count === 1 ? "" : "s"}</span> : <ArrowRight className="size-4 text-muted-foreground" aria-hidden />}
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function ObservatoryTeaser() {
  await connection();
  const h = await headlineBalance();
  if (!h) {
    return (
      <div className="rounded-2xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
        <BarChart3 className="mb-3 size-6 text-primary" aria-hidden />
        Os dados oficiais ainda não foram publicados neste ambiente. O observatório exibirá apenas números importados das fontes
        oficiais — nunca estimativas fictícias.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border bg-card p-6">
      <p className="text-sm text-muted-foreground">Saldo do emprego formal no Brasil — {formatMonth(h.period)}</p>
      <p className={`mt-1 text-5xl font-extrabold tabular-nums ${h.balance >= 0 ? "text-primary" : "text-[var(--chart-neg)]"}`}>{formatSigned(h.balance)}</p>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-muted-foreground">Admissões</dt><dd className="text-lg font-semibold">{formatNumber(h.admissions)}</dd></div>
        <div><dt className="text-muted-foreground">Desligamentos</dt><dd className="text-lg font-semibold">{formatNumber(h.separations)}</dd></div>
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">Fonte: Novo CAGED/MTE, dados com ajustes. Não se refere a vagas anunciadas na plataforma.</p>
    </div>
  );
}
