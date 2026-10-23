"use client";

import { Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useActionForm } from "@/components/forms/use-action-form";
import { FormRootError, SubmitButton, TextField } from "@/components/forms/fields";
import { deleteAccountAction, updatePrivacySettingsAction } from "@/app/actions/candidate";
import { privacySettingsSchema, type PrivacySettingsInput } from "@/lib/validation/profile";
import { deleteAccountSchema } from "@/lib/validation/privacy";
import { VISIBILITY_LABEL } from "@/lib/constants";

type BoolKey = Exclude<keyof PrivacySettingsInput, "visibility">;

export function PrivacySettingsForm({ defaults }: { defaults: PrivacySettingsInput }) {
  const { form, onSubmit, pending } = useActionForm({ schema: privacySettingsSchema, action: updatePrivacySettingsAction, defaultValues: defaults });

  const toggle = (name: BoolKey, title: string, description: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <div className="flex items-start justify-between gap-4 py-3">
          <div>
            <Label htmlFor={`pv-${name}`} className="font-medium">{title}</Label>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Switch id={`pv-${name}`} checked={Boolean(field.value)} onCheckedChange={field.onChange} />
        </div>
      )}
    />
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <FormRootError form={form} />
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="font-semibold text-petroleum">Visibilidade do perfil</h2>
        <Controller
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} className="mt-3 space-y-2" aria-label="Visibilidade do perfil">
              {(["PRIVATE", "VERIFIED_COMPANIES"] as const).map((v) => (
                <div key={v} className="flex items-center gap-3 rounded-lg border p-3">
                  <RadioGroupItem id={`vis-${v}`} value={v} />
                  <Label htmlFor={`vis-${v}`} className="font-normal">{VISIBILITY_LABEL[v]}</Label>
                </div>
              ))}
            </RadioGroup>
          )}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Hoje seu perfil só é visto por empresas às quais você se candidata. A busca de talentos por empresas verificadas ainda não está
          disponível; quando for lançada, só incluirá perfis com a opção “Visível para recrutadores” marcada.
        </p>
        <div className="mt-3 divide-y">
          {toggle("showEmailToCompanies", "Compartilhar e-mail nas candidaturas (padrão)", "Você ainda pode mudar a cada candidatura.")}
          {toggle("showPhoneToCompanies", "Compartilhar telefone nas candidaturas (padrão)", "Você ainda pode mudar a cada candidatura.")}
          {toggle("recommendationsEnabled", "Recomendações de vagas", "Usar meu perfil e preferências para sugerir vagas para mim. Não afeta como as empresas avaliam candidaturas.")}
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="font-semibold text-petroleum">Comunicações</h2>
        <div className="mt-1 divide-y">
          {toggle("emailApplicationUpdates", "Atualizações de candidaturas por e-mail", "Avisos quando uma empresa muda o status da sua candidatura.")}
          {toggle("emailJobAlerts", "Alertas de vagas por e-mail", "Envio dos alertas que você criou.")}
          {toggle("emailProductNews", "Novidades e dicas do Emprego Agora", "Opcional, baseado no seu consentimento. Desmarque a qualquer momento.")}
        </div>
      </section>
      <SubmitButton pending={pending}>Salvar preferências</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const { form, onSubmit, pending } = useActionForm({
    schema: deleteAccountSchema,
    action: deleteAccountAction,
    defaultValues: { password: "", confirmation: "" as "EXCLUIR" },
    successToast: false,
  });
  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <FormRootError form={form} />
      <TextField form={form} name="password" label="Sua senha" type="password" autoComplete="current-password" required />
      <TextField form={form} name="confirmation" label='Digite "EXCLUIR" para confirmar' autoComplete="off" required />
      <SubmitButton pending={pending} variant="destructive">Excluir minha conta definitivamente</SubmitButton>
    </form>
  );
}
