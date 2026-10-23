"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  decideOrgAction,
  moderateJobAction,
  resolveReportAction,
  revokeUserSessionsAction,
  setDatasetStatusAction,
  setUserStatusAction,
  updatePrivacyRequestAction,
} from "@/app/actions/admin";
import type { ActionResult } from "@/server/action";

type Choice = { label: string; run: (notes: string | null) => Promise<ActionResult>; variant?: "default" | "outline" | "destructive"; needsNotes?: boolean };

/** Botões de decisão com campo de observação (obrigatório quando a decisão afeta terceiros). */
function DecisionBar({ choices, notesLabel = "Observações (enviadas ao interessado quando aplicável)" }: { choices: Choice[]; notesLabel?: string }) {
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState("");
  const anyNotes = choices.some((c) => c.needsNotes !== false);
  return (
    <div className="space-y-2">
      {anyNotes && (
        <Textarea aria-label={notesLabel} placeholder={notesLabel} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className="text-sm" />
      )}
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <Button
            key={c.label}
            size="sm"
            variant={c.variant ?? "outline"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (c.needsNotes && notes.trim().length < 5) {
                  toast.error("Descreva o motivo (mín. 5 caracteres).");
                  return;
                }
                const r = await c.run(notes.trim() || null);
                if (r.ok) {
                  toast.success(r.message ?? "Feito.");
                  setNotes("");
                } else toast.error(r.error);
              })
            }
          >
            {c.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function OrgDecision({ orgId, status }: { orgId: string; status: string }) {
  const choices: Choice[] = [];
  if (status === "PENDING" || status === "REJECTED") choices.push({ label: "Verificar", variant: "default", run: (n) => decideOrgAction({ orgId, decision: "verify", notes: n }) });
  if (status === "PENDING") choices.push({ label: "Recusar", needsNotes: true, run: (n) => decideOrgAction({ orgId, decision: "reject", notes: n }) });
  if (status === "VERIFIED" || status === "PENDING") choices.push({ label: "Suspender", variant: "destructive", needsNotes: true, run: (n) => decideOrgAction({ orgId, decision: "suspend", notes: n }) });
  if (status === "SUSPENDED") choices.push({ label: "Reativar", run: (n) => decideOrgAction({ orgId, decision: "reinstate", notes: n }) });
  return <DecisionBar choices={choices} />;
}

export function JobDecision({ jobId, status }: { jobId: string; status: string }) {
  const choices: Choice[] = [];
  if (status === "PENDING_REVIEW") choices.push({ label: "Aprovar publicação", variant: "default", run: (n) => moderateJobAction({ jobId, decision: "approve", notes: n }) });
  if (status !== "REMOVED") choices.push({ label: "Remover vaga", variant: "destructive", needsNotes: true, run: (n) => moderateJobAction({ jobId, decision: "remove", notes: n }) });
  return <DecisionBar choices={choices} notesLabel="Motivo (enviado à empresa)" />;
}

export function ReportDecision({ reportId }: { reportId: string }) {
  return (
    <DecisionBar
      notesLabel="Resolução (registro interno)"
      choices={[
        { label: "Em análise", run: (n) => resolveReportAction({ reportId, status: "REVIEWING", resolution: n }) },
        { label: "Procedente / resolvida", variant: "default", needsNotes: true, run: (n) => resolveReportAction({ reportId, status: "RESOLVED", resolution: n }) },
        { label: "Improcedente", needsNotes: true, run: (n) => resolveReportAction({ reportId, status: "DISMISSED", resolution: n }) },
      ]}
    />
  );
}

export function PrivacyDecision({ id }: { id: string }) {
  return (
    <DecisionBar
      notesLabel="Resposta ao titular (será exibida a ele)"
      choices={[
        { label: "Em atendimento", run: (n) => updatePrivacyRequestAction({ id, status: "IN_PROGRESS", response: n }) },
        { label: "Concluir", variant: "default", needsNotes: true, run: (n) => updatePrivacyRequestAction({ id, status: "COMPLETED", response: n }) },
        { label: "Indeferir (com justificativa)", needsNotes: true, run: (n) => updatePrivacyRequestAction({ id, status: "REJECTED", response: n }) },
      ]}
    />
  );
}

export function UserControls({ userId, status }: { userId: string; status: string }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Feito.");
      else toast.error(r.error);
    });
  return (
    <div className="flex flex-wrap gap-2">
      {status === "ACTIVE" ? (
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => confirm("Suspender esta conta?") && run(() => setUserStatusAction({ userId, status: "SUSPENDED" }))}>Suspender</Button>
      ) : status === "SUSPENDED" ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setUserStatusAction({ userId, status: "ACTIVE" }))}>Reativar</Button>
      ) : null}
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => revokeUserSessionsAction({ userId }))}>Encerrar sessões</Button>
    </div>
  );
}

export function DatasetControls({ datasetId, status }: { datasetId: string; status: string }) {
  const [pending, start] = useTransition();
  const run = (s: "PUBLISHED" | "ARCHIVED") =>
    start(async () => {
      const r = await setDatasetStatusAction({ datasetId, status: s });
      if (r.ok) toast.success(r.message ?? "Feito.");
      else toast.error(r.error);
    });
  return (
    <div className="flex gap-2">
      {status !== "PUBLISHED" && <Button size="sm" disabled={pending} onClick={() => run("PUBLISHED")}>Publicar</Button>}
      {status !== "ARCHIVED" && <Button size="sm" variant="outline" disabled={pending} onClick={() => run("ARCHIVED")}>Arquivar</Button>}
    </div>
  );
}
