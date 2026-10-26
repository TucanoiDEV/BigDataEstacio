"use client";

import { useState, useTransition } from "react";
import { Briefcase, GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useActionForm } from "@/components/forms/use-action-form";
import { CheckboxField, FormRootError, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import {
  deleteEducationAction,
  deleteExperienceAction,
  saveEducationAction,
  saveExperienceAction,
} from "@/app/actions/candidate";
import { educationSchema, experienceSchema, type EducationInput, type ExperienceInput } from "@/lib/validation/profile";

function fmtMonth(v: string | null | undefined) {
  if (!v) return "";
  const [y, m] = v.split("-");
  return `${m}/${y}`;
}

function DeleteButton({ onDelete, label }: { onDelete: () => Promise<{ ok: boolean; error?: string }>; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!confirm("Confirma a exclusão?")) return;
          const r = await onDelete();
          if (!r.ok) toast.error(r.error);
          else toast.success("Removido.");
        })
      }
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

type Exp = ExperienceInput & { id: string };

export function ExperienceSection({ items }: { items: Exp[] }) {
  const [editing, setEditing] = useState<Exp | "new" | null>(null);
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="exp-title">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="exp-title" className="flex items-center gap-2 font-semibold text-petroleum"><Briefcase className="size-4" aria-hidden /> Experiências</h2>
        <Button variant="outline" onClick={() => setEditing("new")}><Plus /> Adicionar</Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma experiência adicionada. Estágios, trabalhos voluntários e freelas também contam.</p>
      ) : (
        <ul className="divide-y">
          {items.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">{e.title}</p>
                <p className="text-sm text-muted-foreground">{e.company}{e.city ? ` · ${e.city}` : ""}</p>
                <p className="text-xs text-muted-foreground">{fmtMonth(e.startDate)} – {e.isCurrent ? "atual" : fmtMonth(e.endDate)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Editar ${e.title}`} onClick={() => setEditing(e)}><Pencil className="size-4" /></Button>
                <DeleteButton label={`Excluir ${e.title}`} onDelete={() => deleteExperienceAction({ id: e.id }) as Promise<{ ok: boolean; error?: string }>} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing === "new" ? "Nova experiência" : "Editar experiência"}</DialogTitle></DialogHeader>
          {editing !== null && <ExperienceForm initial={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ExperienceForm({ initial, onDone }: { initial?: Exp; onDone: () => void }) {
  const { form, onSubmit, pending } = useActionForm({
    schema: experienceSchema,
    action: saveExperienceAction,
    defaultValues: initial ?? { title: "", company: "", city: "", startDate: "", endDate: "", isCurrent: false, description: "" },
    onSuccess: onDone,
  });
  const isCurrent = form.watch("isCurrent");
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormRootError form={form} />
      <TextField form={form} name="title" label="Cargo" required />
      <TextField form={form} name="company" label="Empresa" required />
      <TextField form={form} name="city" label="Cidade" />
      <div className="grid grid-cols-2 gap-3">
        <TextField form={form} name="startDate" label="Início" type="month" required />
        <TextField form={form} name="endDate" label="Término" type="month" disabled={isCurrent} />
      </div>
      <CheckboxField form={form} name="isCurrent" label="Trabalho atual" />
      <TextAreaField form={form} name="description" label="Principais atividades" rows={4} />
      <SubmitButton pending={pending}>Salvar</SubmitButton>
    </form>
  );
}

type Edu = EducationInput & { id: string };

export function EducationSection({ items }: { items: Edu[] }) {
  const [editing, setEditing] = useState<Edu | "new" | null>(null);
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="edu-title">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="edu-title" className="flex items-center gap-2 font-semibold text-petroleum"><GraduationCap className="size-4" aria-hidden /> Formação</h2>
        <Button variant="outline" onClick={() => setEditing("new")}><Plus /> Adicionar</Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma formação adicionada. Inclua cursos técnicos, graduação ou certificações.</p>
      ) : (
        <ul className="divide-y">
          {items.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">{e.degree}{e.field ? `, ${e.field}` : ""}</p>
                <p className="text-sm text-muted-foreground">{e.institution}</p>
                <p className="text-xs text-muted-foreground">{e.inProgress ? "Em andamento" : e.endDate ? `Concluído em ${fmtMonth(e.endDate)}` : ""}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Editar ${e.degree}`} onClick={() => setEditing(e)}><Pencil className="size-4" /></Button>
                <DeleteButton label={`Excluir ${e.degree}`} onDelete={() => deleteEducationAction({ id: e.id }) as Promise<{ ok: boolean; error?: string }>} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing === "new" ? "Nova formação" : "Editar formação"}</DialogTitle></DialogHeader>
          {editing !== null && <EducationForm initial={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function EducationForm({ initial, onDone }: { initial?: Edu; onDone: () => void }) {
  const { form, onSubmit, pending } = useActionForm({
    schema: educationSchema,
    action: saveEducationAction,
    defaultValues: initial ?? { institution: "", degree: "", field: "", startDate: "", endDate: "", inProgress: false },
    onSuccess: onDone,
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormRootError form={form} />
      <TextField form={form} name="institution" label="Instituição" required />
      <TextField form={form} name="degree" label="Curso / nível" placeholder="Ex.: Tecnólogo em Análise de Sistemas" required />
      <TextField form={form} name="field" label="Área" />
      <div className="grid grid-cols-2 gap-3">
        <TextField form={form} name="startDate" label="Início" type="month" />
        <TextField form={form} name="endDate" label="Término (ou previsão)" type="month" />
      </div>
      <CheckboxField form={form} name="inProgress" label="Em andamento" />
      <SubmitButton pending={pending}>Salvar</SubmitButton>
    </form>
  );
}
