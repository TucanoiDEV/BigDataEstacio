import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/auth-forms";
import { SectionSkeleton } from "@/components/common/states";
import { getSessionState } from "@/server/auth/dal";
import { safeNextPath } from "@/lib/validation/auth";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage(props: PageProps<"/entrar">) {
  return (
    <AuthCard
      title="Entrar"
      description="Acesse sua conta de candidato(a) ou recrutador(a)."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link href="/criar-conta" className="font-semibold text-primary hover:underline">
            Criar conta gratuita
          </Link>
        </>
      }
    >
      <Suspense fallback={<SectionSkeleton rows={3} />}>
        <LoginContent searchParams={props.searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginContent({ searchParams }: { searchParams: PageProps<"/entrar">["searchParams"] }) {
  const sp = await searchParams;
  const next = safeNextPath.parse(typeof sp.next === "string" ? sp.next : undefined);
  const s = await getSessionState();
  if (s.state === "active") redirect(next ?? "/minha-conta");

  const notice =
    sp.senha === "redefinida"
      ? "Senha redefinida. Entre com a nova senha."
      : sp.verificado === "1"
        ? "E-mail confirmado! Agora é só entrar."
        : null;

  return (
    <div className="space-y-4">
      {notice && (
        <div role="status" className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden /> {notice}
        </div>
      )}
      <LoginForm next={next} />
    </div>
  );
}
