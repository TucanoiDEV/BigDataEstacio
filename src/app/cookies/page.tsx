import type { Metadata } from "next";
import { LegalPage, LegalSection, LegalTable } from "@/components/legal/legal-page";
import { CookiePreferencesButton } from "@/components/consent/consent-provider";
import { COOKIE_INVENTORY, CONSENT_MAX_AGE_DAYS } from "@/lib/consent";
import { LEGAL_VERSIONS } from "@/lib/constants";

export const metadata: Metadata = { title: "Política de Cookies", description: "Quais cookies o Emprego Agora usa e como gerenciar suas preferências." };

const CATEGORY = { necessary: "Necessário", analytics: "Análise", marketing: "Marketing" } as const;
const analyticsConfigured = Boolean(process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL);

export default function CookiesPage() {
  return (
    <LegalPage
      title="Política de Cookies"
      version={LEGAL_VERSIONS.cookies}
      toc={[
        { id: "o-que-sao", label: "O que são cookies" },
        { id: "categorias", label: "Categorias" },
        { id: "inventario", label: "Inventário" },
        { id: "gerenciar", label: "Como gerenciar" },
      ]}
    >
      <LegalSection id="o-que-sao" title="1. O que são cookies">
        <p>Cookies são pequenos arquivos guardados pelo navegador. Usamos apenas cookies de primeira parte para o funcionamento do site e, se você permitir, para estatísticas.</p>
      </LegalSection>
      <LegalSection id="categorias" title="2. Categorias">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Necessários</strong>: mantêm sua sessão segura e registram suas escolhas. Não dependem de consentimento porque o site não funciona sem eles.</li>
          <li><strong>Análise</strong>: medição agregada de audiência. Só são ativados com seu consentimento. {analyticsConfigured ? "Um serviço de análise está configurado neste ambiente." : "Na configuração atual, nenhum serviço de análise está ativo."}</li>
          <li><strong>Marketing</strong>: atualmente não utilizamos cookies de marketing.</li>
        </ul>
        <p>Scripts opcionais não são carregados antes de uma escolha válida. Nenhuma opção vem pré-marcada.</p>
      </LegalSection>
      <LegalSection id="inventario" title="3. Inventário de cookies">
        <LegalTable
          headers={["Nome", "Categoria", "Finalidade", "Duração", "Origem"]}
          rows={COOKIE_INVENTORY.map((c) => [
            <code key="n" className="text-xs">{c.name}</code>,
            CATEGORY[c.category],
            <>{c.purpose}{c.activeWhen && <span className="mt-1 block text-xs text-muted-foreground">{c.activeWhen}</span>}</>,
            c.duration,
            c.provider,
          ])}
        />
        <p className="text-sm text-muted-foreground">Sua escolha vale por {CONSENT_MAX_AGE_DAYS} dias ou até mudarmos esta política; depois disso, perguntaremos novamente. Cada escolha é registrada (com identificador pseudônimo) para comprovar o consentimento.</p>
      </LegalSection>
      <LegalSection id="gerenciar" title="4. Como gerenciar">
        <p>Você pode aceitar, rejeitar ou personalizar os cookies opcionais e revogar o consentimento a qualquer momento:</p>
        <CookiePreferencesButton className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90" />
        <p>Também é possível apagar cookies nas configurações do navegador. Nesse caso, você precisará entrar novamente.</p>
      </LegalSection>
    </LegalPage>
  );
}
