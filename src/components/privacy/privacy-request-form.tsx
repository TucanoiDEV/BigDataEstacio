"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useActionForm } from "@/components/forms/use-action-form";
import { FormRootError, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { createPrivacyRequestAction } from "@/app/actions/candidate";
import { PRIVACY_REQUEST_LABEL, PRIVACY_REQUEST_TYPES, privacyRequestSchema } from "@/lib/validation/privacy";

export function PrivacyRequestForm({ name = "", email = "" }: { name?: string; email?: string }) {
  const [protocol, setProtocol] = useState<string | null>(null);
  const { form, onSubmit, pending } = useActionForm({
    schema: privacyRequestSchema,
    action: createPrivacyRequestAction,
    defaultValues: { requesterName: name, requesterEmail: email, description: "" },
    onSuccess: (r) => setProtocol((r.data as { protocol: string } | undefined)?.protocol ?? null),
  });

  if (protocol) {
    return (
      <div role="status" className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden />
        <p>
          Solicitação registrada com o protocolo <strong>{protocol}</strong>. Você receberá a confirmação por e-mail.
          Poderemos pedir informações adicionais para confirmar sua identidade antes de atender.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormRootError form={form} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField form={form} name="requesterName" label="Nome" autoComplete="name" required />
        <TextField form={form} name="requesterEmail" label="E-mail para resposta" type="email" autoComplete="email" required />
      </div>
      <SelectField form={form} name="type" label="Tipo de solicitação" required options={PRIVACY_REQUEST_TYPES.map((t) => ({ value: t, label: PRIVACY_REQUEST_LABEL[t] }))} />
      <TextAreaField form={form} name="description" label="Descreva seu pedido" rows={4} required hint="Não envie documentos pessoais por aqui. Se precisarmos confirmar sua identidade, entraremos em contato." />
      <SubmitButton pending={pending}>Enviar solicitação</SubmitButton>
    </form>
  );
}
