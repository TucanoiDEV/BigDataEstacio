"use client";

import { Controller } from "react-hook-form";
import { useActionForm } from "@/components/forms/use-action-form";
import {
  CheckboxField,
  CheckboxGroupField,
  FormRootError,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/forms/fields";
import { TagInput } from "@/components/forms/tag-input";
import { updateProfileAction } from "@/app/actions/candidate";
import { profileSchema, type ProfileInput } from "@/lib/validation/profile";
import { CONTRACT_TYPE_LABEL, SECTORS, SENIORITY_LABEL, UFS, WORK_MODEL_LABEL } from "@/lib/constants";

const opts = (rec: Record<string, string>) => Object.entries(rec).map(([value, label]) => ({ value, label }));

export function ProfileForm({ defaults }: { defaults: ProfileInput }) {
  const { form, onSubmit, pending } = useActionForm({ schema: profileSchema, action: updateProfileAction, defaultValues: defaults });

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <FormRootError form={form} />
      <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="font-semibold text-petroleum">Dados básicos</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField form={form} name="name" label="Nome" autoComplete="name" required />
          <TextField form={form} name="headline" label="Título profissional" placeholder="Ex.: Analista de dados" />
          <TextField form={form} name="city" label="Cidade" autoComplete="address-level2" />
          <SelectField form={form} name="state" label="UF" options={UFS.map((u) => ({ value: u.code, label: `${u.code} - ${u.name}` }))} allowEmpty />
          <TextField form={form} name="phone" label="Telefone (opcional)" type="tel" autoComplete="tel" hint="Só é compartilhado se você autorizar em cada candidatura." />
          <TextField form={form} name="linkedinUrl" label="LinkedIn (opcional)" type="url" placeholder="https://" />
          <TextField form={form} name="portfolioUrl" label="Portfólio/site (opcional)" type="url" placeholder="https://" className="sm:col-span-2" />
        </div>
        <TextAreaField form={form} name="about" label="Sobre você" rows={5} hint="Resumo da sua trajetória e do que você busca." />
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="font-semibold text-petroleum">Competências</h2>
        <Controller
          control={form.control}
          name="skills"
          render={({ field, fieldState }) => (
            <TagInput label="Suas competências" value={field.value ?? []} onChange={field.onChange} error={fieldState.error?.message} placeholder="Ex.: Excel, Atendimento, Python" />
          )}
        />
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
        <div>
          <h2 className="font-semibold text-petroleum">Preferências profissionais</h2>
          <p className="text-sm text-muted-foreground">Usadas apenas para ordenar recomendações para você. Você pode alterá-las a qualquer momento.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField form={form} name="desiredTitle" label="Cargo desejado" placeholder="Ex.: Desenvolvedor(a) front-end" />
          <SelectField form={form} name="desiredSeniority" label="Senioridade buscada" options={opts(SENIORITY_LABEL)} allowEmpty />
          <TextField form={form} name="desiredSalaryMin" label="Pretensão salarial mínima (R$/mês)" type="number" min={0} step={100} />
        </div>
        <CheckboxGroupField form={form} name="desiredWorkModels" label="Modalidades de interesse" options={opts(WORK_MODEL_LABEL)} />
        <CheckboxGroupField form={form} name="desiredContractTypes" label="Tipos de contratação" options={opts(CONTRACT_TYPE_LABEL)} />
        <CheckboxGroupField form={form} name="desiredSectors" label="Setores de interesse (até 5)" options={SECTORS.map((s) => ({ value: s, label: s }))} />
        <CheckboxField form={form} name="openToRelocation" label="Tenho disponibilidade para mudança de cidade" />
      </section>

      <div className="sticky bottom-0 z-10 -mx-1 flex justify-end border-t bg-background/95 px-1 py-3 backdrop-blur">
        <SubmitButton pending={pending}>Salvar perfil</SubmitButton>
      </div>
    </form>
  );
}
