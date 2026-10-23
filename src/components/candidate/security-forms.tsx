"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Copy, KeyRound, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionForm } from "@/components/forms/use-action-form";
import { FormRootError, SubmitButton, TextField } from "@/components/forms/fields";
import {
  changePasswordAction,
  confirmMfaSetupAction,
  disableMfaAction,
  startMfaSetupAction,
} from "@/app/actions/auth";
import { revokeSessionAction } from "@/app/actions/candidate";
import { changePasswordSchema, disableMfaSchema } from "@/lib/validation/auth";

export function ChangePasswordForm() {
  const { form, onSubmit, pending } = useActionForm({
    schema: changePasswordSchema,
    action: changePasswordAction,
    defaultValues: { current: "", password: "", confirm: "" },
    onSuccess: () => form.reset(),
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormRootError form={form} />
      <TextField form={form} name="current" label="Senha atual" type="password" autoComplete="current-password" required />
      <TextField form={form} name="password" label="Nova senha" type="password" autoComplete="new-password" required />
      <TextField form={form} name="confirm" label="Confirme a nova senha" type="password" autoComplete="new-password" required />
      <SubmitButton pending={pending}>Alterar senha</SubmitButton>
    </form>
  );
}

export function MfaManager({ enabled, recoveryLeft }: { enabled: boolean; recoveryLeft: number }) {
  const [pending, start] = useTransition();
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (codes) {
    return (
      <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="flex items-center gap-2 font-semibold text-emerald-900"><ShieldCheck className="size-5" aria-hidden /> Verificação em duas etapas ativada</p>
        <p className="text-sm text-emerald-950">
          Guarde estes códigos de recuperação em local seguro. Cada um pode ser usado <strong>uma única vez</strong> se você perder o celular.
          Eles não serão exibidos novamente.
        </p>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
          {codes.map((c) => <li key={c} className="rounded bg-white px-2 py-1 text-center">{c}</li>)}
        </ul>
        <Button variant="outline" onClick={() => { navigator.clipboard.writeText(codes.join("\n")); toast.success("Códigos copiados."); }}>
          <Copy /> Copiar códigos
        </Button>
        <Button onClick={() => { setCodes(null); window.location.reload(); }}>Concluir</Button>
      </div>
    );
  }

  if (enabled) return <DisableMfa recoveryLeft={recoveryLeft} />;

  if (!setup) {
    return (
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await startMfaSetupAction({});
            if (r.ok && r.data) setSetup(r.data);
            else if (!r.ok) toast.error(r.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Ativar verificação em duas etapas
      </Button>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr]">
      <Image src={setup.qrDataUrl} alt="QR code para configurar o aplicativo autenticador" width={200} height={200} unoptimized className="rounded-lg border bg-white p-2" />
      <div className="space-y-3">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Escaneie o QR code com seu aplicativo autenticador.</li>
          <li>Ou digite a chave manualmente: <code className="break-all rounded bg-muted px-1.5 py-0.5 text-xs">{setup.secret}</code></li>
          <li>Informe o código de 6 dígitos gerado.</li>
        </ol>
        <form
          className="flex max-w-sm items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await confirmMfaSetupAction({ code });
              if (r.ok && r.data) setCodes(r.data.recoveryCodes);
              else if (!r.ok) setError(r.error);
            });
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="mfa-code">Código</Label>
            <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-invalid={Boolean(error)} />
          </div>
          <Button type="submit" disabled={pending || code.length !== 6} className="h-9">Confirmar</Button>
        </form>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function DisableMfa({ recoveryLeft }: { recoveryLeft: number }) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: disableMfaSchema,
    action: disableMfaAction,
    defaultValues: { password: "", code: "" },
    onSuccess: () => window.location.reload(),
  });
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-medium text-emerald-800"><ShieldCheck className="size-4" aria-hidden /> Ativa · {recoveryLeft} código(s) de recuperação disponível(is)</p>
      {!open ? (
        <Button variant="outline" onClick={() => setOpen(true)}>Desativar</Button>
      ) : (
        <form onSubmit={onSubmit} className="max-w-md space-y-3" noValidate>
          <FormRootError form={form} />
          <TextField form={form} name="password" label="Senha" type="password" autoComplete="current-password" />
          <TextField form={form} name="code" label="Código atual do aplicativo" inputMode="numeric" />
          <SubmitButton pending={pending} variant="destructive">Desativar verificação</SubmitButton>
        </form>
      )}
    </div>
  );
}

export function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => {
      const r = await revokeSessionAction({ sessionId });
      if (r.ok) toast.success(r.message ?? "Encerrada.");
      else toast.error(r.error);
    })}>
      <LogOut /> Encerrar
    </Button>
  );
}
