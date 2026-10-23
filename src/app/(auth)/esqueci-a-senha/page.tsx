import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Recuperar acesso", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Recuperar acesso"
      description="Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um link válido por 1 hora."
      footer={
        <Link href="/entrar" className="font-medium text-primary hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
