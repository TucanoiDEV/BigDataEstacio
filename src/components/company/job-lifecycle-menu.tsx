"use client";

import { useTransition } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { jobLifecycleAction } from "@/app/actions/company";
import type { JobStatus } from "@/generated/prisma/browser";

export function JobLifecycleMenu({ orgId, jobId, status }: { orgId: string; jobId: string; status: JobStatus }) {
  const [pending, start] = useTransition();
  const run = (action: "pause" | "resume" | "close") =>
    start(async () => {
      if (action === "close" && !confirm("Encerrar a vaga? Ela deixará de receber candidaturas.")) return;
      const r = await jobLifecycleAction({ orgId, jobId, action });
      if (r.ok) toast.success(r.message ?? "Atualizado.");
      else toast.error(r.error);
    });
  const editable = !["CLOSED", "REMOVED"].includes(status);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-sm" disabled={pending} aria-label="Ações da vaga"><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {editable && <DropdownMenuItem asChild><Link href={`/empresa/${orgId}/vagas/${jobId}/editar`}>Editar</Link></DropdownMenuItem>}
        {status === "ACTIVE" && <DropdownMenuItem onSelect={() => run("pause")}>Pausar</DropdownMenuItem>}
        {status === "PAUSED" && <DropdownMenuItem onSelect={() => run("resume")}>Reativar</DropdownMenuItem>}
        {status === "ACTIVE" && <DropdownMenuItem asChild><Link href={`/vagas/${jobId}`}>Ver anúncio público</Link></DropdownMenuItem>}
        {["ACTIVE", "PAUSED", "DRAFT", "PENDING_REVIEW"].includes(status) && (
          <DropdownMenuItem variant="destructive" onSelect={() => run("close")}>Encerrar</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
