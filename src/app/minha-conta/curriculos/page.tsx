import { Suspense } from "react";
import { FileText } from "lucide-react";
import { EmptyState, PageHeader, SectionSkeleton, StatusBadge } from "@/components/common/states";
import { ResumeUpload, ResumeRowActions } from "@/components/candidate/resume-upload";
import { requireUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Currículos" };

const SCAN_LABEL = {
  CLEAN: { tone: "green", label: "Verificado" },
  SKIPPED: { tone: "amber", label: "Sem antivírus (dev)" },
  PENDING: { tone: "amber", label: "Em verificação" },
  FAILED: { tone: "red", label: "Falha na verificação" },
  INFECTED: { tone: "red", label: "Bloqueado" },
} as const;

export default function ResumesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Currículos"
        description="Envie até 5 currículos em PDF (máx. 5 MB). Os arquivos ficam em armazenamento privado: só você e as empresas às quais você se candidatar com eles podem baixá-los."
      />
      <ResumeUpload />
      <Suspense fallback={<SectionSkeleton rows={3} />}>
        <ResumeList />
      </Suspense>
    </div>
  );
}

async function ResumeList() {
  const user = await requireUser({ returnTo: "/minha-conta/curriculos", allowUnverified: true });
  const resumes = await db.resume.findMany({
    where: { profileId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, isDefault: true, createdAt: true, file: { select: { id: true, originalName: true, sizeBytes: true, scanStatus: true } }, _count: { select: { applications: true } } },
  });
  if (!resumes.length) return <EmptyState icon={FileText} title="Nenhum currículo enviado" description="Você pode se candidatar só com o perfil, mas muitas empresas preferem um PDF." />;
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {resumes.map((r) => {
        const scan = SCAN_LABEL[r.file.scanStatus];
        return (
          <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-red-50 text-red-700"><FileText className="size-5" aria-hidden /></span>
              <div className="min-w-0">
                <p className="truncate font-medium">{r.label} {r.isDefault && <span className="text-xs text-muted-foreground">(padrão)</span>}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.file.originalName} · {(r.file.sizeBytes / 1024).toFixed(0)} KB · enviado em {formatDate(r.createdAt)} · usado em {r._count.applications} candidatura(s)
                </p>
                <div className="mt-1"><StatusBadge tone={scan.tone}>{scan.label}</StatusBadge></div>
              </div>
            </div>
            <ResumeRowActions resumeId={r.id} fileId={r.file.id} isDefault={r.isDefault} />
          </li>
        );
      })}
    </ul>
  );
}
