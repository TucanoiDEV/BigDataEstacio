import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, controller, fill } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Segurança da Informação", description: "Medidas de segurança do Emprego Agora e como reportar vulnerabilidades." };

export default function SecurityPage() {
  return (
    <LegalPage
      title="Segurança da Informação"
      version="2026-10-23"
      toc={[
        { id: "contas", label: "Contas e acesso" },
        { id: "dados", label: "Proteção dos dados" },
        { id: "arquivos", label: "Arquivos enviados" },
        { id: "golpes", label: "Combate a golpes" },
        { id: "operacao", label: "Operação" },
        { id: "incidentes", label: "Incidentes" },
        { id: "reportar", label: "Reportar vulnerabilidade" },
      ]}
      intro={<p className="text-muted-foreground">Esta página descreve as medidas efetivamente implementadas no software. Itens que dependem da infraestrutura de produção estão sinalizados.</p>}
    >
      <LegalSection id="contas" title="1. Contas e acesso">
        <ul className="list-disc space-y-1 pl-5">
          <li>Senhas armazenadas apenas como hash Argon2id; política de senha com tamanho mínimo e bloqueio de senhas comuns.</li>
          <li>Verificação em duas etapas (TOTP) disponível para todos e obrigatória para a administração da plataforma.</li>
          <li>Sessões com identificador aleatório em cookie HttpOnly, Secure e SameSite; armazenadas apenas como hash; expiração por inatividade e prazo máximo; revogáveis pelo usuário.</li>
          <li>Limites de tentativas e bloqueio temporário contra força bruta; respostas que não revelam se um e-mail está cadastrado.</li>
          <li>Autorização verificada no servidor em cada página e ação, por papel e por recurso (cada empresa só acessa as próprias vagas e candidaturas).</li>
        </ul>
      </LegalSection>
      <LegalSection id="dados" title="2. Proteção dos dados">
        <ul className="list-disc space-y-1 pl-5">
          <li>Consultas ao banco parametrizadas; validação de toda entrada no servidor.</li>
          <li>Cabeçalhos de segurança (CSP, HSTS, proteção contra enquadramento e sniffing de tipo).</li>
          <li>Segredos de MFA cifrados (AES-256-GCM); IPs pseudonimizados nos registros.</li>
          <li>Trilha de auditoria de ações sensíveis, sem senhas, tokens ou conteúdo de documentos.</li>
          <li>Criptografia em trânsito (HTTPS) e em repouso no banco e backups: {fill(undefined, "confirmar configuração do provedor de hospedagem")}.</li>
        </ul>
      </LegalSection>
      <LegalSection id="arquivos" title="3. Arquivos enviados">
        <p>
          Currículos e imagens são verificados pelo conteúdo real (não só pela extensão), têm limite de tamanho, são analisados por antivírus e
          guardados em armazenamento privado. PDFs com scripts, anexos embutidos ou senha são recusados. Downloads exigem autorização e são registrados.
        </p>
      </LegalSection>
      <LegalSection id="golpes" title="4. Combate a golpes">
        <p>
          Empresas passam por verificação antes de publicar. Anúncios com sinais típicos de fraude (cobrança de taxas, pedido de dados bancários,
          contato exclusivo por mensageiro, promessas de ganho fácil) ficam retidos para revisão humana. Nunca pague para participar de um processo
          seletivo. <Link href="/vagas" className="text-primary underline">Denuncie</Link> vagas suspeitas pela própria página da vaga.
        </p>
      </LegalSection>
      <LegalSection id="operacao" title="5. Operação">
        <ul className="list-disc space-y-1 pl-5">
          <li>Segredos fora do código-fonte; dependências monitoradas e atualizadas.</li>
          <li>Backups e procedimento de restauração documentados (docs/DEPLOY.md); frequência e retenção: {fill(undefined, "política de backup do ambiente de produção")}.</li>
          <li>Monitoramento e alertas: {fill(undefined, "ferramenta de monitoramento adotada")}.</li>
        </ul>
      </LegalSection>
      <LegalSection id="incidentes" title="6. Incidentes">
        <p>Mantemos registro de incidentes e procedimento de resposta, incluindo avaliação de risco e comunicação à ANPD e aos titulares quando exigido.</p>
      </LegalSection>
      <LegalSection id="reportar" title="7. Reportar uma vulnerabilidade">
        <p>
          Encontrou uma falha? Escreva para {fill(controller.contactEmail, "e-mail de segurança")} com os passos para reproduzir. Não acesse dados de
          terceiros nem degrade o serviço durante testes. Responderemos o quanto antes.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
