"use client";

import { Controller } from "react-hook-form";
import { z } from "zod";
import type { JobStatus } from "@/generated/prisma/browser";
import { useActionForm } from "@/components/forms/use-action-form";
import { CheckboxField, FormRootError, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { TagInput } from "@/components/forms/tag-input";
import { createJobAction, updateJobAction } from "@/app/actions/company";
import { jobSchema, type JobInput } from "@/lib/validation/job";
import { CONTRACT_TYPE_LABEL, SECTORS, SENIORITY_LABEL, UFS, WORK_MODEL_LABEL } from "@/lib/constants";

const opts = (rec: Record<string, string>) => Object.entries(rec).map(([value, label]) => ({ value, label }));

// Na edição, ACTIVE e PENDING_REVIEW gravam direto no anúncio: não existe rascunho separado.
const EDIT_NOTICE: Partial<Record<JobStatus, string>> = {
  ACTIVE: "Esta vaga está publicada: as alterações ficam visíveis assim que forem salvas.",
  PAUSED: "Esta vaga está pausada: salve para manter pausada ou publique para reativá-la.",
  PENDING_REVIEW: "Esta vaga está em análise pela moderação: as alterações serão avaliadas antes da publicação.",
};

export function JobForm({ orgId, jobId, status, defaults, orgVerified }: { orgId: string; jobId?: string; status?: JobStatus; defaults?: Partial<JobInput>; orgVerified: boolean }) {
  const schema = jobSchema.and(z.object({ orgId: z.string(), jobId: z.string().optional() }));
  const { form, onSubmit, pending } = useActionForm({
    schema,
    action: (jobId ? updateJobAction : createJobAction) as never,
    defaultValues: {
      orgId,
      jobId,
      title: "",
      description: "",
      requirements: "",
      benefits: "",
      city: "",
      salaryVisible: true,
      positions: 1,
      skills: [],
      requiredSkills: [],
      publish: false,
      ...defaults,
    } as never,
    successToast: false,
  });
  const workModel = form.watch("workModel" as never) as unknown as string | undefined;

  const submit = (publish: boolean) => {
    form.setValue("publish" as never, publish as never);
    void onSubmit();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="space-y-6" noValidate>
      <FormRootError form={form} />
      <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="font-semibold text-petroleum">Informações da vaga</h2>
        <TextField form={form} name={"title" as never} label="Título" required placeholder="Ex.: Analista de Suporte Júnior" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField form={form} name={"sector" as never} label="Setor" options={SECTORS.map((s) => ({ value: s, label: s }))} required />
          <SelectField form={form} name={"seniority" as never} label="Senioridade" options={opts(SENIORITY_LABEL)} required />
          <SelectField form={form} name={"contractType" as never} label="Contratação" options={opts(CONTRACT_TYPE_LABEL)} required />
          <SelectField form={form} name={"workModel" as never} label="Modalidade" options={opts(WORK_MODEL_LABEL)} required />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField form={form} name={"city" as never} label="Cidade" required={workModel !== "REMOTE"} hint={workModel === "REMOTE" ? "Opcional para vagas remotas." : undefined} />
          <SelectField form={form} name={"state" as never} label="UF" options={UFS.map((u) => ({ value: u.code, label: `${u.code} — ${u.name}` }))} allowEmpty />
          <TextField form={form} name={"positions" as never} label="Nº de posições" type="number" min={1} max={1000} />
        </div>
        <TextField
          form={form}
          name={"closesAt" as never}
          label="Inscrições até"
          type="date"
          className="sm:max-w-xs"
          hint="Opcional. Depois dessa data, a vaga sai da busca e para de receber candidaturas."
        />
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="font-semibold text-petroleum">Remuneração</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField form={form} name={"salaryMin" as never} label="Salário mínimo (R$/mês)" type="number" min={0} step={100} />
          <TextField form={form} name={"salaryMax" as never} label="Salário máximo (R$/mês)" type="number" min={0} step={100} />
        </div>
        <CheckboxField form={form} name={"salaryVisible" as never} label="Exibir faixa salarial no anúncio" description="Vagas com salário informado costumam receber candidaturas mais alinhadas." />
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="font-semibold text-petroleum">Descrição</h2>
        <TextAreaField form={form} name={"description" as never} label="Descrição da vaga" rows={8} required hint="Atividades, contexto do time e etapas do processo. Texto simples; parágrafos separados por linha em branco." />
        <TextAreaField form={form} name={"requirements" as never} label="Requisitos" rows={5} />
        <TextAreaField form={form} name={"benefits" as never} label="Benefícios" rows={4} />
        <Controller
          control={form.control}
          name={"skills" as never}
          render={({ field, fieldState }) => (
            <Controller
              control={form.control}
              name={"requiredSkills" as never}
              render={({ field: req }) => (
                <TagInput
                  label="Competências"
                  value={(field.value as string[]) ?? []}
                  onChange={(v) => {
                    field.onChange(v);
                    req.onChange(((req.value as string[]) ?? []).filter((r) => v.includes(r)));
                  }}
                  error={fieldState.error?.message}
                  hint="Clique em uma competência para marcá-la como obrigatória (★). Se nenhuma for marcada, todas contam como obrigatórias."
                  toggleable={{
                    selected: (req.value as string[]) ?? [],
                    label: "Marcar como obrigatória",
                    onToggle: (tag) => {
                      const cur = (req.value as string[]) ?? [];
                      req.onChange(cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]);
                    },
                  }}
                />
              )}
            />
          )}
        />
      </section>

      <div className="rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground">
        Anúncios que pedem pagamento, dados bancários ou contato exclusivo por mensageiro são retidos para moderação.
        {!orgVerified && " Sua empresa ainda não foi verificada: por enquanto é possível apenas salvar como rascunho."}
      </div>

      {status && EDIT_NOTICE[status] && (
        <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {EDIT_NOTICE[status]}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {status === "ACTIVE" || status === "PENDING_REVIEW" ? (
          <SubmitButton pending={pending}>Salvar alterações</SubmitButton>
        ) : (
          <>
            <SubmitButton pending={pending} variant="outline">{status === "PAUSED" ? "Salvar (manter pausada)" : "Salvar rascunho"}</SubmitButton>
            <SubmitButton pending={pending} type="button" disabled={!orgVerified || pending} onClick={() => submit(true)}>
              {jobId ? "Salvar e publicar" : "Publicar vaga"}
            </SubmitButton>
          </>
        )}
      </div>
    </form>
  );
}
