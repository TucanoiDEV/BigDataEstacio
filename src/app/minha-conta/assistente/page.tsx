import { Suspense } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { EmptyState, PageHeader, SectionSkeleton } from "@/components/common/states";
import { AssistantChat, AssistantConsent } from "@/components/candidate/assistant-chat";
import { requireUser } from "@/server/auth/dal";
import { assistantConfigured, hasAssistantConsent } from "@/server/services/assistant";

export const metadata = { title: "Assistente" };

export default function AssistantPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Assistente" description="Pergunte sobre vagas que combinam com você, suas candidaturas ou como usar o site." />
      <Suspense fallback={<SectionSkeleton rows={6} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const user = await requireUser({ returnTo: "/minha-conta/assistente" });
  if (!assistantConfigured()) {
    return (
      <EmptyState
        icon={MessageCircleQuestion}
        title="Assistente indisponível"
        description="O assistente ainda não foi ativado neste site. Enquanto isso, veja as vagas sugeridas no seu painel."
        action={{ href: "/minha-conta", label: "Ir para o painel" }}
      />
    );
  }
  if (!(await hasAssistantConsent(user.id))) return <AssistantConsent />;
  return <AssistantChat />;
}
