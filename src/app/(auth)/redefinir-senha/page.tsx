import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { EmptyState, SectionSkeleton } from "@/components/common/states";
import { peekToken } from "@/server/services/tokens";

export const metadata: Metadata = {
  title: "Nova senha",
  robots: { index: false },
  // Evita vazar o token via cabeçalho Referer para recursos externos.
  referrer: "no-referrer",
};

export default function ResetPasswordPage(props: PageProps<"/redefinir-senha">) {
  return (
    <AuthCard title="Defina uma nova senha" description="Ao salvar, todas as sessões abertas serão encerradas.">
      <Suspense fallback={<SectionSkeleton rows={3} />}>
        <ResetContent searchParams={props.searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function ResetContent({ searchParams }: { searchParams: PageProps<"/redefinir-senha">["searchParams"] }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const valid = /^[A-Za-z0-9_-]{30,64}$/.test(token) && (await peekToken(token, "PASSWORD_RESET"));
  if (!valid) {
    return (
      <EmptyState
        title="Link inválido ou expirado"
        description={
          <>
            Os links de redefinição valem por 1 hora e só podem ser usados uma vez.{" "}
            <Link href="/esqueci-a-senha" className="text-primary underline">Solicite um novo link</Link>.
          </>
        }
      />
    );
  }
  return <ResetPasswordForm token={token} />;
}
