import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, CalendarCheck, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { CardListSkeleton, EmptyState, PageHeader, SectionSkeleton } from "@/components/common/states";
import { ApplicationStatusBadge } from "@/components/common/application-status-badge";
import { JobCard } from "@/components/jobs/job-card";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { recommendJobs } from "@/server/services/recommendations";
import { ensureProfile } from "@/server/services/profile";
import { formatRelative } from "@/lib/format";

export const metadata = { title: "Painel" };

export default function CandidateDashboard() {
  return (
    <div className="space-y-8">
      <Suspense fallback={<SectionSkeleton rows={3} />}>
        <Overview />
      </Suspense>
      <section aria-labelledby="recomendadas" className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="recomendadas" className="flex items-center gap-2 text-lg font-semibold text-petroleum">
              <Sparkles className="size-5 text-primary" aria-hidden /> Recomendadas para você
            </h2>
            <p className="text-sm text-muted-foreground">
              Ordenadas por competências, interesses, experiência, localização e modalidade que você informou.{" "}
              <Link href="/minha-conta/privacidade" className="text-primary underline">Ajustar</Link>
            </p>
          </div>
          <Link href="/vagas" className="hidden text-sm font-medium text-primary hover:underline sm:block">Ver todas as vagas</Link>
        </div>
        <Suspense fallback={<CardListSkeleton count={3} />}>
          <Recommendations />
        </Suspense>
      </section>
    </div>
  );
}

async function Overview() {
  const user = await requireUser({ returnTo: "/minha-conta" });
  await ensureProfile(user.id);
  const now = new Date();
  const [profile, counts, recent] = await Promise.all([
    db.candidateProfile.findUniqueOrThrow({
      where: { userId: user.id },
      select: { headline: true, about: true, city: true, desiredTitle: true, photoFileId: true, _count: { select: { experiences: true, educations: true, skills: true, resumes: true } } },
    }),
    db.application.groupBy({ by: ["status"], where: { candidateUserId: user.id }, _count: { _all: true } }),
    db.application.findMany({
      where: { candidateUserId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { id: true, status: true, updatedAt: true, job: { select: { title: true, org: { select: { tradeName: true } } } } },
    }),
  ]);

  const checks = [
    { done: Boolean(profile.headline), label: "Título profissional" },
    { done: Boolean(profile.about), label: "Resumo sobre você" },
    { done: Boolean(profile.city), label: "Cidade" },
    { done: Boolean(profile.desiredTitle), label: "Cargo desejado" },
    { done: profile._count.skills >= 3, label: "Pelo menos 3 competências" },
    { done: profile._count.experiences > 0, label: "Experiência" },
    { done: profile._count.educations > 0, label: "Formação" },
    { done: profile._count.resumes > 0, label: "Currículo em PDF" },
  ];
  const pct = Math.round((checks.filter((c) => c.done).length / checks.length) * 100);
  const count = (s: string[]) => counts.filter((c) => s.includes(c.status)).reduce((a, c) => a + c._count._all, 0);
  const stats = [
    { label: "Candidaturas enviadas", value: count(["SUBMITTED", "IN_REVIEW", "INTERVIEW", "APPROVED", "REJECTED", "WITHDRAWN"]), icon: Briefcase },
    { label: "Em andamento", value: count(["SUBMITTED", "IN_REVIEW"]), icon: Clock },
    { label: "Entrevistas", value: count(["INTERVIEW"]), icon: CalendarCheck },
    { label: "Aprovadas", value: count(["APPROVED"]), icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Painel do candidato" title={`Olá, ${user.name.split(" ")[0]}!`} description="Acompanhe suas candidaturas e descubra vagas alinhadas ao seu perfil." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <span className="grid size-9 place-items-center rounded-lg bg-secondary text-secondary-foreground"><s.icon className="size-4" aria-hidden /></span>
            </div>
            <p className="mt-2 text-3xl font-bold text-petroleum">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
        <section className="rounded-xl border bg-card p-5" aria-labelledby="recentes">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="recentes" className="font-semibold text-petroleum">Candidaturas recentes</h2>
            <Link href="/minha-conta/candidaturas" className="text-sm font-medium text-primary hover:underline">Ver todas</Link>
          </div>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Você ainda não se candidatou a nenhuma vaga. <Link href="/vagas" className="text-primary underline">Explorar vagas</Link></p>
          ) : (
            <ul className="divide-y">
              {recent.map((a) => (
                <li key={a.id}>
                  <Link href={`/minha-conta/candidaturas/${a.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.job.title}</p>
                      <p className="truncate text-sm text-muted-foreground">{a.job.org.tradeName} · atualizada {formatRelative(a.updatedAt, now)}</p>
                    </div>
                    <ApplicationStatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border bg-card p-5" aria-labelledby="forca-perfil">
          <h2 id="forca-perfil" className="font-semibold text-petroleum">Perfil completo</h2>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={pct} aria-label="Completude do perfil" className="h-2" />
            <span className="text-sm font-semibold">{pct}%</span>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm">
            {checks.filter((c) => !c.done).slice(0, 4).map((c) => (
              <li key={c.label} className="text-muted-foreground">• {c.label}</li>
            ))}
          </ul>
          <Link href="/minha-conta/perfil" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Completar perfil <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
      </div>
    </div>
  );
}

async function Recommendations() {
  const user = await requireUser({ returnTo: "/minha-conta" });
  const now = new Date();
  const { items: recs, sparseProfile } = await recommendJobs(user.id, now, 6);
  if (recs.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Ainda não temos recomendações"
        description="Adicione competências, cargo desejado e preferências de modalidade ao seu perfil — ou verifique se as recomendações estão ativadas em Privacidade."
        action={{ href: "/minha-conta/perfil", label: "Atualizar perfil" }}
      />
    );
  }
  return (
    <div className="space-y-4">
      {sparseProfile && (
        <p role="note" className="rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground">
          Seu perfil ainda não tem competências, cargo desejado nem setores de interesse, então estas sugestões são genéricas.{" "}
          <Link href="/minha-conta/perfil" className="font-medium text-primary underline">Complete seu perfil</Link> para melhorar as recomendações.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {recs.map(({ job, rec }) => (
          <JobCard key={job.id} job={job} now={now} reasons={rec.reasons} />
        ))}
      </div>
    </div>
  );
}
