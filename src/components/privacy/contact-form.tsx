"use client";

import { useActionForm } from "@/components/forms/use-action-form";
import { FormRootError, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { contactAction } from "@/app/actions/public";
import { contactSchema } from "@/lib/validation/privacy";

const SUBJECTS = [
  { value: "DUVIDA", label: "Dúvida sobre a plataforma" },
  { value: "EMPRESA", label: "Sou uma empresa" },
  { value: "SEGURANCA", label: "Segurança" },
  { value: "IMPRENSA", label: "Imprensa" },
  { value: "OUTRO", label: "Outro assunto" },
];

export function ContactForm() {
  const { form, onSubmit, pending } = useActionForm({
    schema: contactSchema,
    action: contactAction,
    defaultValues: { name: "", email: "", message: "" },
    onSuccess: () => form.reset({ name: "", email: "", message: "" }),
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormRootError form={form} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField form={form} name="name" label="Nome" autoComplete="name" required />
        <TextField form={form} name="email" label="E-mail" type="email" autoComplete="email" required />
      </div>
      <SelectField form={form} name="subject" label="Assunto" options={SUBJECTS} required />
      <TextAreaField form={form} name="message" label="Mensagem" rows={6} required hint="Não envie senhas, documentos ou dados sensíveis." />
      <SubmitButton pending={pending}>Enviar mensagem</SubmitButton>
    </form>
  );
}
