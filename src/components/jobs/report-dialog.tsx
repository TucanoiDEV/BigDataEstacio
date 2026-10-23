"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useActionForm } from "@/components/forms/use-action-form";
import { FormRootError, SelectField, SubmitButton, TextAreaField } from "@/components/forms/fields";
import { reportJobAction } from "@/app/actions/public";

const REASONS = [
  { value: "SCAM", label: "Possível golpe" },
  { value: "PAYMENT_REQUEST", label: "Cobra taxa do candidato" },
  { value: "MISLEADING", label: "Informações enganosas" },
  { value: "DISCRIMINATORY", label: "Conteúdo discriminatório" },
  { value: "DUPLICATE", label: "Vaga duplicada" },
  { value: "OTHER", label: "Outro motivo" },
] as const;

const schema = z.object({
  jobId: z.string(),
  reason: z.enum(["SCAM", "PAYMENT_REQUEST", "MISLEADING", "DISCRIMINATORY", "DUPLICATE", "OTHER"], { error: "Escolha um motivo." }),
  details: z.string().trim().min(10, "Descreva em pelo menos 10 caracteres.").max(2000),
});

export function ReportDialog({ jobId, signedIn }: { jobId: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema,
    action: reportJobAction,
    defaultValues: { jobId, details: "" },
    onSuccess: () => {
      setOpen(false);
      form.reset({ jobId, details: "" });
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="lg" className="h-10 px-3 text-muted-foreground">
          <Flag /> Denunciar vaga
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Denunciar vaga</DialogTitle>
          <DialogDescription>Sua denúncia é analisada pela equipe de moderação. A empresa não vê quem denunciou.</DialogDescription>
        </DialogHeader>
        {signedIn ? (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormRootError form={form} />
            <SelectField form={form} name="reason" label="Motivo" options={REASONS} required />
            <TextAreaField form={form} name="details" label="O que aconteceu?" rows={4} required />
            <SubmitButton pending={pending}>Enviar denúncia</SubmitButton>
          </form>
        ) : (
          <p className="text-sm">
            Para evitar abusos, denúncias exigem login.{" "}
            <Link href={`/entrar?next=/vagas/${jobId}`} className="font-medium text-primary underline">Entrar</Link>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
