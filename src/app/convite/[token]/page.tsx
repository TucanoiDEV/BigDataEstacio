import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { EmptyState, SectionSkeleton } from "@/components/common/states";
import { AcceptInviteButton } from "@/components/company/accept-invite-button";
import { requireUser } from "@/server/auth/dal";
import { getInvitation } from "@/server/services/organizations";
import { ORG_ROLE_LABEL } from "@/lib/constants";

export const metadata: Metadata = { title: "Convite", robots: { index: false }, referrer: "no-referrer" };

export default function InvitePage(props: PageProps<"/convite/[token]">) {
  return (
    <div className="container-page max-w-lg py-12">
      <Suspense fallback={<SectionSkeleton rows={3} />}>
        <Content params={props.params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: PageProps<"/convite/[token]">["params"] }) {
  const { token } = await params;
  const user = await requireUser({ returnTo: `/convite/${token}` });
  const inv = /^[A-Za-z0-9_-]{30,64}$/.test(token) ? await getInvitation(token) : null;
  if (!inv) return <EmptyState title="Convite inválido ou expirado" description="Peça um novo convite a quem administra a empresa." />;
  const sameEmail = inv.email === user.email;
  return (
    <AuthCard title={`Convite para ${inv.org.tradeName}`} description={`Papel: ${ORG_ROLE_LABEL[inv.role]}`}>
      {sameEmail ? (
        <AcceptInviteButton token={token} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Este convite foi enviado para outro endereço de e-mail. Entre com a conta correspondente ao e-mail convidado para aceitá-lo.
        </p>
      )}
    </AuthCard>
  );
}
