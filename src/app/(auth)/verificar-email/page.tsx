import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerificationForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Confirme seu e-mail", robots: { index: false } };

export default function VerifyEmailPage() {
  return (
    <AuthCard
      title="Confirme seu e-mail"
      description="Para proteger sua conta e evitar cadastros indevidos, confirmamos o e-mail antes de liberar candidaturas e publicação de vagas."
    >
      <div className="space-y-6">
        <div className="flex gap-3 rounded-lg bg-secondary p-4 text-sm text-secondary-foreground">
          <MailCheck className="size-5 shrink-0" aria-hidden />
          <p>
            Se o cadastro foi concluído, enviamos um link de confirmação para o seu e-mail. Ele expira em 24 horas.
            Verifique também a caixa de spam.
          </p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">Não recebeu? Peça um novo link</h2>
          <ResendVerificationForm />
        </div>
      </div>
    </AuthCard>
  );
}
