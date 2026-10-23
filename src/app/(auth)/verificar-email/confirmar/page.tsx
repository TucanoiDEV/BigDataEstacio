import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SectionSkeleton } from "@/components/common/states";
import { ConfirmEmailButton } from "@/components/auth/confirm-email-button";

export const metadata: Metadata = { title: "Confirmar e-mail", robots: { index: false }, referrer: "no-referrer" };

// A confirmação exige um clique (POST). Assim, verificadores automáticos de links
// em provedores de e-mail não consomem o token de uso único.
export default function ConfirmEmailPage(props: PageProps<"/verificar-email/confirmar">) {
  return (
    <AuthCard title="Confirmar e-mail" description="Clique no botão abaixo para concluir a confirmação do seu endereço.">
      <Suspense fallback={<SectionSkeleton rows={1} />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/verificar-email/confirmar">["searchParams"] }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  return <ConfirmEmailButton token={token} />;
}
