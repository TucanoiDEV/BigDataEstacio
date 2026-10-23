import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, controller, fill } from "@/components/legal/legal-page";
import { LEGAL_VERSIONS } from "@/lib/constants";

export const metadata: Metadata = { title: "Termos de Uso", description: "Regras de uso do Emprego Agora para candidatos e empresas." };

export default function TermsPage() {
  return (
    <LegalPage
      title="Termos de Uso"
      version={LEGAL_VERSIONS.terms}
      toc={[
        { id: "aceite", label: "Aceite" },
        { id: "conta", label: "Conta e segurança" },
        { id: "candidatos", label: "Candidatos" },
        { id: "empresas", label: "Empresas recrutadoras" },
        { id: "proibido", label: "Condutas proibidas" },
        { id: "moderacao", label: "Moderação e denúncias" },
        { id: "observatorio", label: "Observatório de dados" },
        { id: "responsabilidade", label: "Responsabilidades" },
        { id: "encerramento", label: "Suspensão e encerramento" },
        { id: "lei", label: "Lei aplicável e foro" },
      ]}
    >
      <LegalSection id="aceite" title="1. Aceite">
        <p>
          Estes Termos regulam o uso da plataforma Emprego Agora, operada por {fill(controller.name, "razão social")} (CNPJ {fill(controller.cnpj, "CNPJ")}).
          Ao criar uma conta você declara ter lido estes Termos e a <Link href="/privacidade" className="text-primary underline">Política de Privacidade</Link>.
        </p>
      </LegalSection>
      <LegalSection id="conta" title="2. Conta e segurança">
        <ul className="list-disc space-y-1 pl-5">
          <li>As informações da conta devem ser verdadeiras. A conta é pessoal e intransferível.</li>
          <li>Você é responsável por manter a senha em sigilo. Recomendamos ativar a verificação em duas etapas.</li>
          <li>Avise-nos imediatamente em caso de uso indevido pela <Link href="/contato" className="text-primary underline">página de contato</Link>.</li>
        </ul>
      </LegalSection>
      <LegalSection id="candidatos" title="3. Candidatos">
        <ul className="list-disc space-y-1 pl-5">
          <li>O uso é gratuito para candidatos. Nenhuma empresa pode cobrar valores para candidatura, cursos ou materiais como condição de seleção.</li>
          <li>Você decide, em cada candidatura, quais dados de contato compartilhar com a empresa.</li>
          <li>A plataforma não garante contratação, retorno das empresas nem a veracidade das informações de terceiros, embora modere vagas e empresas.</li>
        </ul>
      </LegalSection>
      <LegalSection id="empresas" title="4. Empresas recrutadoras">
        <ul className="list-disc space-y-1 pl-5">
          <li>Somente empresas verificadas publicam vagas. Quem cadastra a empresa declara ter poderes para representá-la.</li>
          <li>As vagas devem ser reais, descrever com fidelidade a função, o local e, quando informado, a remuneração.</li>
          <li>É proibido exigir pagamento de candidatos, solicitar dados bancários, senhas ou documentos antes da contratação, ou direcionar candidatos para canais externos com o objetivo de contornar a plataforma.</li>
          <li>
            É proibida qualquer prática discriminatória no recrutamento (por exemplo, por sexo, origem, raça, cor, estado civil, situação familiar,
            deficiência ou idade), nos termos da Lei nº 9.029/1995 e demais normas aplicáveis.
          </li>
          <li>
            Os dados recebidos dos candidatos só podem ser usados para o processo seletivo correspondente, com segurança adequada, e eliminados quando
            não forem mais necessários. A empresa responde, como controladora, pelo tratamento que realizar e deve atender aos direitos dos titulares.
          </li>
          <li>A empresa deve manter os status das candidaturas atualizados de boa-fé e comunicar-se com respeito.</li>
        </ul>
      </LegalSection>
      <LegalSection id="proibido" title="5. Condutas proibidas">
        <ul className="list-disc space-y-1 pl-5">
          <li>Publicar conteúdo falso, enganoso, ilícito, ofensivo ou que viole direitos de terceiros.</li>
          <li>Coletar dados de outros usuários por meios automatizados (scraping) ou usá-los para finalidades diferentes do recrutamento.</li>
          <li>Tentar burlar mecanismos de segurança, acessar contas ou dados de terceiros, ou sobrecarregar o serviço.</li>
          <li>Enviar arquivos com código malicioso.</li>
        </ul>
      </LegalSection>
      <LegalSection id="moderacao" title="6. Moderação e denúncias">
        <p>
          Vagas com sinais de fraude são retidas para revisão humana antes da publicação. Qualquer usuário pode denunciar vagas. Podemos remover
          conteúdo e suspender empresas ou contas que violem estes Termos, registrando a decisão e o motivo.
        </p>
      </LegalSection>
      <LegalSection id="observatorio" title="7. Observatório de dados">
        <p>
          Os indicadores do observatório são reproduzidos de fontes públicas oficiais (MTE e IBGE), com fonte e metodologia indicadas. Têm caráter
          informativo, podem ser revisados pelas fontes e não se confundem com as vagas anunciadas na plataforma.
        </p>
      </LegalSection>
      <LegalSection id="responsabilidade" title="8. Responsabilidades">
        <p>
          Empregamos esforços razoáveis para manter o serviço disponível e seguro, mas não garantimos funcionamento ininterrupto. As decisões de
          contratação e as relações de trabalho são de responsabilidade exclusiva das empresas e dos candidatos.{" "}
          <mark className="rounded bg-amber-100 px-1 text-amber-950">[REVISÃO JURÍDICA: limites de responsabilidade e incidência do CDC.]</mark>
        </p>
      </LegalSection>
      <LegalSection id="encerramento" title="9. Suspensão e encerramento">
        <p>Você pode excluir sua conta a qualquer momento em Minha conta → Privacidade. Podemos suspender contas em caso de violação destes Termos ou de risco à segurança de outros usuários.</p>
      </LegalSection>
      <LegalSection id="lei" title="10. Lei aplicável e foro">
        <p>Estes Termos são regidos pelas leis brasileiras. Foro: {fill(undefined, "comarca eleita, observado o direito do consumidor ao foro do seu domicílio")}.</p>
      </LegalSection>
    </LegalPage>
  );
}
