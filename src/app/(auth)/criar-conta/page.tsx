import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta gratuita para se candidatar a vagas, salvar favoritas e receber alertas.",
};

export default function SignUpPage() {
  return (
    <AuthCard
      title="Criar conta"
      description="Uma única conta serve para buscar vagas e, se você recruta, para gerenciar empresas."
      footer={
        <>
          Já tem conta?{" "}
          <Link href="/entrar" className="font-semibold text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
