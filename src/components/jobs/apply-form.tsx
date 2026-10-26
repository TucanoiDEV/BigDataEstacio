"use client";

import Link from "next/link";
import { Controller } from "react-hook-form";
import { z } from "zod";
import { FileText, ShieldCheck } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useActionForm } from "@/components/forms/use-action-form";
import { CheckboxField, FormRootError, SubmitButton, TextAreaField } from "@/components/forms/fields";
import { applyAction } from "@/app/actions/candidate";

const schema = z.object({
  jobId: z.string(),
  resumeId: z.string().nullable(),
  coverLetter: z.string().max(3000, "Máximo de 3000 caracteres.").nullish(),
  shareEmail: z.boolean(),
  sharePhone: z.boolean(),
  confirm: z.literal(true, { error: "Confirme o compartilhamento dos dados com a empresa." }),
});

export function ApplyForm(props: {
  jobId: string;
  orgName: string;
  resumes: { id: string; label: string; isDefault: boolean }[];
  email: string;
  phone: string | null;
  defaultShareEmail: boolean;
  defaultSharePhone: boolean;
}) {
  const defaultResume = props.resumes.find((r) => r.isDefault)?.id ?? props.resumes[0]?.id ?? null;
  const { form, onSubmit, pending } = useActionForm({
    schema,
    action: applyAction,
    defaultValues: {
      jobId: props.jobId,
      resumeId: defaultResume,
      coverLetter: "",
      shareEmail: props.defaultShareEmail,
      sharePhone: props.defaultSharePhone && Boolean(props.phone),
      confirm: false as unknown as true,
    },
    successToast: false,
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <FormRootError form={form} />
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold text-petroleum">Currículo</h2>
        {props.resumes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Você ainda não enviou currículo em PDF. Ele é opcional: a empresa verá seu perfil.{" "}
            <Link href="/minha-conta/curriculos" className="font-medium text-primary underline">Enviar currículo</Link>
          </p>
        ) : (
          <Controller
            control={form.control}
            name="resumeId"
            render={({ field }) => (
              <RadioGroup value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? null : v)} className="mt-3 space-y-2" aria-label="Escolha o currículo">
                {props.resumes.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <RadioGroupItem value={r.id} id={`r-${r.id}`} />
                    <Label htmlFor={`r-${r.id}`} className="flex items-center gap-2 font-normal">
                      <FileText className="size-4 text-muted-foreground" aria-hidden /> {r.label}
                      {r.isDefault && <span className="text-xs text-muted-foreground">(padrão)</span>}
                    </Label>
                  </div>
                ))}
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <RadioGroupItem value="none" id="r-none" />
                  <Label htmlFor="r-none" className="font-normal">Enviar sem currículo (apenas perfil)</Label>
                </div>
              </RadioGroup>
            )}
          />
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <TextAreaField form={form} name="coverLetter" label="Mensagem para a empresa (opcional)" rows={5} hint="Conte por que você se interessa pela vaga. Não inclua documentos pessoais." />
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-semibold text-petroleum"><ShieldCheck className="size-4" aria-hidden /> O que será compartilhado com {props.orgName}</h2>
        <p className="text-sm text-muted-foreground">
          Nome, título profissional, cidade/UF, resumo, experiências, formação, competências e links do perfil, além do
          currículo escolhido e da mensagem. Sua foto não é compartilhada. A empresa poderá ver apenas esta candidatura,
          não suas outras candidaturas.
        </p>
        <CheckboxField form={form} name="shareEmail" label={`Compartilhar meu e-mail (${props.email})`} />
        {props.phone ? (
          <CheckboxField form={form} name="sharePhone" label={`Compartilhar meu telefone (${props.phone})`} />
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum telefone cadastrado no perfil.</p>
        )}
        <CheckboxField
          form={form}
          name="confirm"
          label="Concordo em compartilhar esses dados com a empresa para participar deste processo seletivo."
          description={<Link href="/privacidade#compartilhamento" target="_blank" className="text-primary underline">Saiba como a empresa pode usar seus dados</Link>}
        />
      </section>

      <div className="flex flex-wrap gap-3">
        <SubmitButton pending={pending}>Enviar candidatura</SubmitButton>
        <Link href={`/vagas/${props.jobId}`} className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium hover:bg-muted">Cancelar</Link>
      </div>
    </form>
  );
}
