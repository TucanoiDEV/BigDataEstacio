"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useActionForm } from "@/components/forms/use-action-form";
import { CheckboxField, FormRootError, SubmitButton, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import {
  completeMfaAction,
  loginAction,
  requestPasswordResetAction,
  resendVerificationAction,
  resetPasswordAction,
  signUpAction,
} from "@/app/actions/auth";
import {
  emailOnlySchema,
  loginSchema,
  mfaCodeSchema,
  resetPasswordSchema,
  signUpSchema,
} from "@/lib/validation/auth";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { z } from "zod";

function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onToggle} aria-pressed={shown} className="text-xs">
      {shown ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
      {shown ? "Ocultar senha" : "Mostrar senha"}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [show, setShow] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: loginSchema,
    action: loginAction,
    defaultValues: { email: "", password: "", next },
    successToast: false,
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormRootError form={form} />
      <TextField form={form} name="email" label="E-mail" type="email" autoComplete="email" required />
      <TextField form={form} name="password" label="Senha" type={show ? "text" : "password"} autoComplete="current-password" required />
      <div className="flex items-center justify-between">
        <PasswordToggle shown={show} onToggle={() => setShow((s) => !s)} />
        <Link href="/esqueci-a-senha" className="text-sm font-medium text-primary hover:underline">
          Esqueci a senha
        </Link>
      </div>
      <SubmitButton pending={pending} className="w-full">
        Entrar
      </SubmitButton>
    </form>
  );
}

export function SignUpForm() {
  const [show, setShow] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: signUpSchema,
    action: signUpAction,
    defaultValues: { name: "", email: "", password: "", acceptTerms: false as unknown as true },
    successToast: false,
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormRootError form={form} />
      <TextField form={form} name="name" label="Nome completo" autoComplete="name" required />
      <TextField form={form} name="email" label="E-mail" type="email" autoComplete="email" required />
      <TextField
        form={form}
        name="password"
        label="Senha"
        type={show ? "text" : "password"}
        autoComplete="new-password"
        hint={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres. Prefira uma frase longa e única.`}
        required
      />
      <PasswordToggle shown={show} onToggle={() => setShow((s) => !s)} />
      <CheckboxField
        form={form}
        name="acceptTerms"
        label="Li e aceito os Termos de Uso e estou ciente da Política de Privacidade."
        description={
          <>
            <Link href="/termos" target="_blank" className="text-primary underline">Termos de Uso</Link>
            {" · "}
            <Link href="/privacidade" target="_blank" className="text-primary underline">Política de Privacidade</Link>
          </>
        }
      />
      <p className="text-xs text-muted-foreground">
        Não pedimos CPF, data de nascimento nem dados sensíveis para criar a conta. Comunicações de novidades
        são opcionais e ficam desativadas até você escolher.
      </p>
      <SubmitButton pending={pending} className="w-full">
        Criar conta
      </SubmitButton>
    </form>
  );
}

export function MfaForm({ next }: { next?: string }) {
  const schema = mfaCodeSchema.extend({ next: z.string().optional() });
  const { form, onSubmit, pending } = useActionForm({
    schema,
    action: completeMfaAction,
    defaultValues: { code: "", next },
    successToast: false,
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormRootError form={form} />
      <TextField
        form={form}
        name="code"
        label="Código de verificação"
        inputMode="numeric"
        autoComplete="one-time-code"
        hint="Digite o código de 6 dígitos do aplicativo autenticador ou um código de recuperação."
        required
        autoFocus
      />
      <SubmitButton pending={pending} className="w-full">
        Verificar
      </SubmitButton>
    </form>
  );
}

function EmailRequestForm(props: {
  action: typeof requestPasswordResetAction;
  submitLabel: string;
}) {
  const [done, setDone] = useState<string | null>(null);
  const { form, onSubmit, pending } = useActionForm({
    schema: emailOnlySchema,
    action: props.action,
    defaultValues: { email: "" },
    successToast: false,
    onSuccess: (r) => setDone(r.message ?? "Pronto."),
  });
  if (done) {
    return (
      <div role="status" className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden />
        <p>{done}</p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormRootError form={form} />
      <TextField form={form} name="email" label="E-mail" type="email" autoComplete="email" required />
      <SubmitButton pending={pending} className="w-full">
        {props.submitLabel}
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  return <EmailRequestForm action={requestPasswordResetAction} submitLabel="Enviar link de redefinição" />;
}

export function ResendVerificationForm() {
  return <EmailRequestForm action={resendVerificationAction} submitLabel="Reenviar e-mail de confirmação" />;
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [show, setShow] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: resetPasswordSchema,
    action: resetPasswordAction,
    defaultValues: { token, password: "", confirm: "" },
    successToast: false,
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormRootError form={form} />
      <TextField form={form} name="password" label="Nova senha" type={show ? "text" : "password"} autoComplete="new-password" hint={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`} required />
      <TextField form={form} name="confirm" label="Confirme a nova senha" type={show ? "text" : "password"} autoComplete="new-password" required />
      <PasswordToggle shown={show} onToggle={() => setShow((s) => !s)} />
      <SubmitButton pending={pending} className="w-full">
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}
