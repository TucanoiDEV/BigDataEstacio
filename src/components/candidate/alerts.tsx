"use client";

import { useTransition } from "react";
import { Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/components/forms/use-action-form";
import { FormRootError, SelectField, SubmitButton, TextField } from "@/components/forms/fields";
import { createAlertAction, deleteAlertAction, updateAlertAction } from "@/app/actions/candidate";
import type { AlertFilters } from "@/lib/validation/search";

const schema = z.object({
  name: z.string().trim().min(2, "Dê um nome ao alerta.").max(80),
  frequency: z.enum(["DAILY", "WEEKLY"]),
  filters: z.any(),
});

export function AlertForm({ filters, summary }: { filters: AlertFilters; summary: string }) {
  const { form, onSubmit, pending } = useActionForm({
    schema,
    action: createAlertAction as never,
    defaultValues: { name: filters.q ? `Vagas de ${filters.q}` : "", frequency: "WEEKLY", filters },
    onSuccess: () => form.reset({ name: "", frequency: "WEEKLY", filters }),
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-card p-5" noValidate>
      <h2 className="font-semibold text-petroleum">Novo alerta</h2>
      <p className="text-sm text-muted-foreground">
        Filtros: <span className="font-medium text-foreground">{summary}</span>. Para mudar os filtros, faça uma nova busca em “Explorar vagas”.
      </p>
      <FormRootError form={form} />
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <TextField form={form} name="name" label="Nome do alerta" required />
        <SelectField form={form} name="frequency" label="Frequência" options={[{ value: "DAILY", label: "Diário" }, { value: "WEEKLY", label: "Semanal" }]} />
        <SubmitButton pending={pending} className="h-9">Criar alerta</SubmitButton>
      </div>
    </form>
  );
}

export function AlertRowActions({ alertId, active }: { alertId: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => {
        const r = await updateAlertAction({ alertId, active: !active });
        if (!r.ok) toast.error(r.error);
      })}>
        {active ? <><Pause /> Pausar</> : <><Play /> Retomar</>}
      </Button>
      <Button variant="ghost" size="sm" className="text-destructive" disabled={pending} onClick={() => start(async () => {
        const r = await deleteAlertAction({ alertId });
        if (!r.ok) toast.error(r.error);
        else toast.success("Alerta excluído.");
      })}>
        <Trash2 /> Excluir
      </Button>
    </div>
  );
}
