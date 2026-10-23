import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, LegalTable, controller, fill } from "@/components/legal/legal-page";
import { LEGAL_VERSIONS } from "@/lib/constants";

export const metadata: Metadata = { title: "Política de Privacidade", description: "Como o Emprego Agora trata dados pessoais, com base na LGPD." };

const TOC = [
  { id: "controlador", label: "Quem é o controlador" },
  { id: "papeis", label: "Papéis da plataforma e das empresas" },
  { id: "dados", label: "Dados, finalidades e bases legais" },
  { id: "nao-coletamos", label: "O que não coletamos" },
  { id: "compartilhamento", label: "Compartilhamento" },
  { id: "recomendacoes", label: "Recomendações e decisões automatizadas" },
  { id: "retencao", label: "Retenção" },
  { id: "direitos", label: "Seus direitos" },
  { id: "seguranca", label: "Segurança e incidentes" },
  { id: "transferencia", label: "Transferência internacional" },
  { id: "menores", label: "Crianças e adolescentes" },
  { id: "alteracoes", label: "Alterações" },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Política de Privacidade" version={LEGAL_VERSIONS.privacy} toc={TOC}
      intro={<p className="text-muted-foreground">Esta política explica quais dados pessoais tratamos, por quê, com quem compartilhamos e como você exerce seus direitos previstos na Lei nº 13.709/2018 (LGPD).</p>}>
      <LegalSection id="controlador" title="1. Quem é o controlador">
        <p>
          O controlador dos dados tratados na plataforma Emprego Agora é {fill(controller.name, "razão social do controlador")}, inscrito no CNPJ
          sob o nº {fill(controller.cnpj, "CNPJ")}, com sede em {fill(controller.address, "endereço completo")}.
        </p>
        <p>
          Encarregado(a) pelo tratamento de dados pessoais (DPO): {fill(controller.dpoName, "nome do encarregado")} — {fill(controller.dpoEmail, "e-mail do encarregado")}.
          Você também pode usar a <Link href="/central-de-privacidade" className="text-primary underline">Central de Privacidade</Link>.
        </p>
      </LegalSection>

      <LegalSection id="papeis" title="2. Papéis da plataforma e das empresas recrutadoras">
        <p>
          O Emprego Agora atua como <strong>controlador</strong> dos dados da sua conta, do seu perfil, das suas preferências e dos registros de uso da plataforma.
        </p>
        <p>
          Quando você se candidata a uma vaga, a <strong>empresa recrutadora</strong> recebe o recorte de dados que você confirmou compartilhar e passa a
          tratá-lo, para fins do processo seletivo, como <strong>controladora independente</strong>, sujeita à LGPD e aos nossos Termos de Uso. A
          empresa é responsável pelo uso que fizer desses dados, inclusive de currículos baixados.
          {" "}<mark className="rounded bg-amber-100 px-1 text-amber-950">[REVISÃO JURÍDICA: confirmar a qualificação (controladoria independente ou conjunta) conforme o modelo de negócio e os contratos com empresas.]</mark>
        </p>
      </LegalSection>

      <LegalSection id="dados" title="3. Dados, finalidades e bases legais">
        <LegalTable
          headers={["Dados", "Finalidade", "Base legal (LGPD, art. 7º)"]}
          rows={[
            ["Nome, e-mail, senha (armazenada apenas como hash Argon2id)", "Criar e manter sua conta; autenticação", "Execução de contrato (V)"],
            ["Perfil profissional: título, resumo, cidade/UF, telefone (opcional), experiências, formação, competências, links, preferências", "Exibir seu perfil às empresas às quais você se candidata; recomendações de vagas", "Execução de contrato e procedimentos preliminares a pedido do titular (V)"],
            ["Currículo em PDF e foto (opcionais)", "Anexar à candidatura (currículo); identificação visual apenas para você (foto)", "Execução de contrato (V)"],
            ["Candidaturas, histórico de status e mensagens", "Permitir o processo seletivo e o acompanhamento", "Execução de contrato (V)"],
            ["Dados de recrutadores e empresas (nome, e-mail corporativo, CNPJ da empresa)", "Verificação de empresas e prevenção a fraudes", "Execução de contrato (V) e legítimo interesse (IX)"],
            [
              <>Registros de acesso (data, hora, IP){" "}<mark className="rounded bg-amber-100 px-1 text-amber-950">[REVISÃO JURÍDICA: a aplicação hoje guarda o IP apenas pseudonimizado (HMAC); confirmar se é preciso manter o IP em claro, em armazenamento restrito, para atender ao art. 15 do Marco Civil.]</mark></>,
              "Guarda obrigatória de registros de acesso a aplicações",
              "Cumprimento de obrigação legal (II) — Marco Civil da Internet, art. 15",
            ],
            ["Trilha de auditoria e eventos de segurança", "Segurança, prevenção a fraudes, apuração de incidentes", "Legítimo interesse (IX) e exercício regular de direitos (VI)"],
            ["Cookies necessários", "Sessão e registro das suas escolhas de cookies", "Legítimo interesse (IX) / execução de contrato (V)"],
            ["Cookies analíticos (somente se configurados)", "Estatísticas agregadas de uso", "Consentimento (I)"],
            ["E-mails de novidades", "Comunicação sobre o produto", "Consentimento (I), revogável a qualquer momento"],
            ["Solicitações de privacidade e denúncias", "Atender direitos do titular; moderação", "Cumprimento de obrigação legal (II) e legítimo interesse (IX)"],
          ]}
        />
      </LegalSection>

      <LegalSection id="nao-coletamos" title="4. O que não coletamos">
        <p>
          Não pedimos CPF, data de nascimento, gênero, raça/cor, religião, deficiência, filiação sindical, dados de saúde ou outros dados pessoais
          sensíveis. Recomendamos que você <strong>não inclua</strong> esse tipo de informação no currículo ou nos textos do perfil. O observatório
          usa microdados oficiais anonimizados e descarta atributos pessoais na importação.
        </p>
      </LegalSection>

      <LegalSection id="compartilhamento" title="5. Compartilhamento">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Empresas que você escolhe</strong>: somente o recorte confirmado na candidatura. Sua foto não é enviada; e-mail e telefone apenas se você marcar.</li>
          <li><strong>Recrutadores de empresas verificadas</strong>: somente se você ativar “perfil visível para empresas verificadas” (busca de talentos ainda não disponível; hoje o perfil só é visto nas candidaturas).</li>
          <li><strong>Operadores</strong> que nos prestam serviços: {fill(undefined, "lista de fornecedores — hospedagem, banco de dados, envio de e-mail (SMTP), antivírus, backup, monitoramento")}.</li>
          <li><strong>Autoridades</strong>, quando houver obrigação legal ou ordem judicial.</li>
        </ul>
        <p>Não vendemos dados pessoais.</p>
      </LegalSection>

      <LegalSection id="recomendacoes" title="6. Recomendações e decisões automatizadas">
        <p>
          As recomendações de vagas são calculadas com regras transparentes a partir de competências, cargo e setores de interesse, experiência,
          localização, modalidade, contratação e pretensão salarial que você informou. Mostramos os motivos de cada sugestão e você pode
          desativá-las. As recomendações apenas ordenam sugestões para você: <strong>não</strong> classificam, filtram ou rejeitam candidaturas, e
          nenhuma decisão sobre candidatos é tomada de forma automatizada pela plataforma. As decisões dos processos seletivos são das empresas.
        </p>
      </LegalSection>

      <LegalSection id="retencao" title="7. Retenção">
        <LegalTable
          headers={["Dado", "Prazo"]}
          rows={[
            ["Conta e perfil", <>Enquanto a conta estiver ativa; eliminados na exclusão da conta {fill(undefined, "prazo para backups expirarem, ex.: até 35 dias")}</>],
            ["Candidaturas", <>{fill(undefined, "prazo após o encerramento do processo, ex.: 24 meses")} ou até a exclusão da conta</>],
            ["Registros de acesso", "6 meses (Marco Civil da Internet, art. 15)"],
            ["Auditoria e segurança", fill(undefined, "prazo, ex.: 5 anos, justificado por prescrição")],
            ["Solicitações de titulares", fill(undefined, "prazo, ex.: 5 anos")],
            ["Registros de consentimento", "Enquanto necessário para comprovar o consentimento"],
          ]}
        />
      </LegalSection>

      <LegalSection id="direitos" title="8. Seus direitos (LGPD, art. 18)">
        <p>Você pode, a qualquer momento:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>confirmar a existência de tratamento e acessar seus dados — <Link href="/minha-conta/privacidade" className="text-primary underline">exportação em Minha conta → Privacidade</Link>;</li>
          <li>corrigir dados incompletos, inexatos ou desatualizados — editando seu perfil;</li>
          <li>solicitar anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
          <li>obter a portabilidade dos dados (arquivo JSON);</li>
          <li>eliminar sua conta e os dados tratados com base no consentimento;</li>
          <li>obter informação sobre compartilhamentos e sobre a possibilidade de não consentir;</li>
          <li>revogar consentimentos (cookies opcionais e e-mails de novidades) e se opor a tratamentos;</li>
          <li>peticionar à Autoridade Nacional de Proteção de Dados (ANPD).</li>
        </ul>
        <p>Pedidos que não forem atendidos automaticamente podem ser abertos na <Link href="/central-de-privacidade" className="text-primary underline">Central de Privacidade</Link>, com número de protocolo.</p>
      </LegalSection>

      <LegalSection id="seguranca" title="9. Segurança e incidentes">
        <p>
          Adotamos medidas técnicas e organizacionais descritas na página <Link href="/seguranca" className="text-primary underline">Segurança da Informação</Link>.
          Em caso de incidente de segurança que possa acarretar risco ou dano relevante, comunicaremos a ANPD e os titulares afetados nos prazos da regulamentação vigente.
        </p>
      </LegalSection>

      <LegalSection id="transferencia" title="10. Transferência internacional">
        <p>{fill(undefined, "informar se fornecedores armazenam dados fora do Brasil, países envolvidos e mecanismo do art. 33 da LGPD (ex.: cláusulas-padrão contratuais)")}</p>
      </LegalSection>

      <LegalSection id="menores" title="11. Crianças e adolescentes">
        <p>
          A plataforma não se destina a menores de 14 anos. Adolescentes a partir de 14 anos podem buscar vagas de aprendizagem e estágio, e seus dados
          são tratados no seu melhor interesse.{" "}
          <mark className="rounded bg-amber-100 px-1 text-amber-950">[REVISÃO JURÍDICA: avaliar exigências do art. 14 da LGPD e do ECA para adolescentes.]</mark>
        </p>
      </LegalSection>

      <LegalSection id="alteracoes" title="12. Alterações">
        <p>Mudanças relevantes serão comunicadas na plataforma e, quando necessário, por e-mail. A versão vigente fica sempre indicada no topo.</p>
      </LegalSection>
    </LegalPage>
  );
}
