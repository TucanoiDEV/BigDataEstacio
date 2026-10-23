"use client";

import { z } from "zod";
import { useActionForm } from "@/components/forms/use-action-form";
import { FormRootError, SelectField, SubmitButton, TextAreaField } from "@/components/forms/fields";
import { updateApplicationStatusAction } from "@/app/actions/company";

const schema = z.object({
  orgId: z.string(),
  applicationId: z.string(),
  to: z.enum(["IN_REVIEW", "INTERVIEW", "APPROVED", "REJECTED"], { error: "Escolha a nova etapa." }),
  messageToCandidate: z.string().max(1500).nullish(),
  internalNote: z.string().max(1500).nullish(),
});

export function StatusChangeForm({ orgId, applicationId, options }: { orgId: string; applicationId: string; options: { value: string; label: string }[] }) {
  const { form, onSubmit, pending } = useActionForm({
    schema,
    action: updateApplicationStatusAction,
    defaultValues: { orgId, applicationId, messageToCandidate: "", internalNote: "" },
    onSuccess: () => form.reset({ orgId, applicationId, messageToCandidate: "", internalNote: "" }),
  });
  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3" noValidate>
      <FormRootError form={form} />
      <SelectField form={form} name="to" label="Nova etapa" options={options} required />
      <TextAreaField form={form} name="messageToCandidate" label="Mensagem para o(a) candidato(a) (opcional)" rows={3} hint="Enviada junto com a notificação. Seja respeitoso(a) e objetivo(a)." />
      <TextAreaField form={form} name="internalNote" label="Nota interna (opcional)" rows={2} hint="Visível só para a equipe da empresa. Não registre dados sensíveis." />
      <SubmitButton pending={pending} className="w-full">Atualizar etapa</SubmitButton>
    </form>
  );
}
