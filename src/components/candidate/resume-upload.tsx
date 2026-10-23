"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Loader2, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteResumeAction, setDefaultResumeAction, uploadResumeAction } from "@/app/actions/candidate";

export function ResumeUpload() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      className="grid grid-cols-1 gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const file = fd.get("file");
        if (!(file instanceof File) || file.size === 0) return setError("Selecione um arquivo PDF.");
        if (file.size > 5 * 1024 * 1024) return setError("Arquivo muito grande. Limite: 5 MB.");
        setError(null);
        start(async () => {
          const r = await uploadResumeAction(fd);
          if (r.ok) {
            toast.success(r.message ?? "Enviado.");
            formRef.current?.reset();
          } else {
            setError(r.error);
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="resume-file">Arquivo PDF</Label>
        <Input id="resume-file" name="file" type="file" accept="application/pdf" required aria-describedby={error ? "resume-error" : undefined} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="resume-label">Nome para identificar (opcional)</Label>
        <Input id="resume-label" name="label" maxLength={80} placeholder="Ex.: Currículo — Dados" />
      </div>
      <Button type="submit" className="h-9" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Upload />} Enviar
      </Button>
      {error && <p id="resume-error" role="alert" className="text-sm font-medium text-destructive sm:col-span-3">{error}</p>}
      <p className="text-xs text-muted-foreground sm:col-span-3">
        O arquivo é conferido pelo conteúdo (não só pela extensão) e por antivírus. PDFs com scripts, anexos ou senha são recusados.
      </p>
    </form>
  );
}

export function ResumeRowActions({ resumeId, fileId, isDefault }: { resumeId: string; fileId: string; isDefault: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size="sm" asChild>
        <a href={`/api/arquivos/${fileId}`}><Download /> Baixar</a>
      </Button>
      {!isDefault && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => start(async () => {
            const r = await setDefaultResumeAction({ resumeId });
            if (!r.ok) toast.error(r.error);
          })}
        >
          <Star /> Tornar padrão
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        className="text-destructive"
        onClick={() => start(async () => {
          if (!confirm("Excluir este currículo? O arquivo será apagado definitivamente.")) return;
          const r = await deleteResumeAction({ resumeId });
          if (!r.ok) toast.error(r.error);
          else toast.success(r.message ?? "Excluído.");
        })}
      >
        <Trash2 /> Excluir
      </Button>
    </div>
  );
}
