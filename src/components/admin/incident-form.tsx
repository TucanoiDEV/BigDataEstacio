"use client";

import { z } from "zod";
import { useActionForm } from "@/components/forms/use-action-form";
import { CheckboxField, FormRootError, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { saveIncidentAction } from "@/app/actions/admin";

const schema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(5, "Mínimo de 5 caracteres.").max(200),
  description: z.string().trim().min(10, "Descreva o incidente.").max(5000),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  status: z.enum(["OPEN", "CONTAINED", "RESOLVED"]),
  detectedAt: z.string().min(1, "Informe quando foi detectado."),
  personalDataAffected: z.boolean(),
  dataCategories: z.string().max(1000).default(""),
  estimatedSubjects: z.number().int().min(0).nullish(),
  riskAssessment: z.string().max(3000).nullish(),
  anpdNotificationRequired: z.enum(["yes", "no", "undetermined"]),
  anpdNotifiedAt: z.string().nullish(),
  subjectsNotifiedAt: z.string().nullish(),
  actionsTaken: z.string().max(5000).nullish(),
});
type Values = z.input<typeof schema>;

export function IncidentForm({ defaults }: { defaults?: Values }) {
  const { form, onSubmit, pending } = useActionForm({
    schema,
    action: saveIncidentAction as never,
    defaultValues: defaults ?? { title: "", description: "", severity: "MEDIUM", status: "OPEN", detectedAt: "", personalDataAffected: false, dataCategories: "", anpdNotificationRequired: "undetermined", riskAssessment: "", actionsTaken: "" },
    onSuccess: () => {
      if (!defaults) form.reset();
    },
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormRootError form={form} />
      <TextField form={form} name="title" label="Título" required />
      <TextAreaField form={form} name="description" label="O que aconteceu" rows={4} required />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SelectField form={form} name="severity" label="Severidade" options={[{ value: "LOW", label: "Baixa" }, { value: "MEDIUM", label: "Média" }, { value: "HIGH", label: "Alta" }, { value: "CRITICAL", label: "Crítica" }]} />
        <SelectField form={form} name="status" label="Status" options={[{ value: "OPEN", label: "Aberto" }, { value: "CONTAINED", label: "Contido" }, { value: "RESOLVED", label: "Resolvido" }]} />
        <TextField form={form} name="detectedAt" label="Detectado em" type="datetime-local" required />
      </div>
      <CheckboxField form={form} name="personalDataAffected" label="Envolve dados pessoais" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField form={form} name="dataCategories" label="Categorias de dados afetadas (separadas por vírgula)" placeholder="e-mail, currículo, telefone" />
        <TextField form={form} name="estimatedSubjects" label="Titulares afetados (estimativa)" type="number" min={0} />
      </div>
      <TextAreaField form={form} name="riskAssessment" label="Avaliação de risco ou dano relevante aos titulares" rows={3} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SelectField form={form} name="anpdNotificationRequired" label="Comunicação à ANPD" options={[{ value: "undetermined", label: "A avaliar" }, { value: "yes", label: "Necessária" }, { value: "no", label: "Não necessária" }]} />
        <TextField form={form} name="anpdNotifiedAt" label="ANPD comunicada em" type="datetime-local" />
        <TextField form={form} name="subjectsNotifiedAt" label="Titulares comunicados em" type="datetime-local" />
      </div>
      <TextAreaField form={form} name="actionsTaken" label="Medidas adotadas (contenção, mitigação, prevenção)" rows={3} />
      <SubmitButton pending={pending}>{defaults ? "Salvar alterações" : "Registrar incidente"}</SubmitButton>
    </form>
  );
}
