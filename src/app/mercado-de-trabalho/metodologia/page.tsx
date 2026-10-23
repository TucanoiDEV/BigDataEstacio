import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Fontes e metodologia do observatório",
  description: "Como o Emprego Agora coleta, valida e publica dados do Novo CAGED, RAIS e IBGE.",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="space-y-3">
      <h2 id={`${id}-t`} className="text-xl font-bold text-petroleum">{title}</h2>
      <div className="space-y-3 leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

export default function MethodologyPage() {
  return (
    <article className="container-page max-w-3xl space-y-10 py-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Observatório do trabalho</p>
        <h1 className="text-3xl font-bold text-petroleum">Fontes e metodologia</h1>
        <p className="text-muted-foreground">
          Transparência sobre de onde vêm os números, como são tratados e quais são seus limites.
        </p>
      </header>

      <Section id="principios" title="Princípios">
        <ul className="list-disc space-y-1 pl-5">
          <li>Somente fontes públicas oficiais, baixadas diretamente dos servidores do governo (MTE/PDET e IBGE).</li>
          <li>Nenhum dado fictício é exibido como real. Sem conjunto importado e publicado, o painel mostra um aviso de ausência de dados.</li>
          <li>Cada importação registra arquivos, tamanho, SHA-256, linhas lidas, válidas e rejeitadas; a publicação exige aprovação humana.</li>
          <li><strong>Vagas anunciadas na plataforma não se confundem</strong> com movimentações do Novo CAGED (contratações e desligamentos realizados) nem com vínculos da RAIS (estoque de empregos).</li>
          <li>Atributos pessoais presentes nos microdados (sexo, raça/cor, idade, escolaridade, deficiência) não são processados nem armazenados.</li>
        </ul>
      </Section>

      <Section id="caged" title="Novo CAGED (Ministério do Trabalho e Emprego)">
        <p>
          Registros mensais de admissões e desligamentos de empregados com carteira assinada, declarados pelos empregadores (eSocial/CAGED).
          Usamos os microdados públicos do PDET: <code>CAGEDMOV</code> (declarações no prazo), <code>CAGEDFOR</code> (fora do prazo, atribuídas à
          competência original) e <code>CAGEDEXC</code> (exclusões, subtraídas da competência original).
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Saldo</strong> = admissões − desligamentos. Pode ser negativo.</li>
          <li><strong>Competências recentes</strong> podem ser revistas à medida que novas declarações fora do prazo são recebidas.</li>
          <li><strong>Territórios</strong>: Brasil, UF e município (código IBGE). Movimentações sem território identificado entram apenas no total Brasil.</li>
          <li><strong>Setores</strong>: seções da CNAE 2.0 (IBGE). <strong>Ocupações</strong>: grandes grupos da CBO 2002 (MTE). Municípios têm apenas totais.</li>
          <li>
            <strong>Salário</strong>: publicamos a <em>mediana</em> do salário contratual de admissão — mais robusta a valores extremos do que a média —,
            apenas para mensalistas não intermitentes, entre 0,3 e 150 salários mínimos e com no mínimo 30 admissões válidas no recorte.
            Por isso pode diferir da média divulgada pelo MTE.
          </li>
          <li>Os valores podem diferir ligeiramente das publicações oficiais por diferenças de data de extração e de tratamento; para fins oficiais, consulte a fonte.</li>
        </ul>
        <p>
          Fonte: <a className="text-primary underline" href="https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/novo-caged" target="_blank" rel="noopener noreferrer">Novo CAGED — MTE</a>.
        </p>
      </Section>

      <Section id="pnad" title="PNAD Contínua (IBGE)">
        <p>
          Taxa de desocupação trimestral das pessoas de 14 anos ou mais (tabela 4099 do SIDRA), para Brasil e UFs. É uma pesquisa amostral
          domiciliar: as estimativas têm margem de erro e não são comparáveis diretamente com os registros administrativos do CAGED.
        </p>
      </Section>

      <Section id="rais" title="RAIS (Ministério do Trabalho e Emprego)">
        <p>
          A RAIS informa o estoque de vínculos formais em 31 de dezembro de cada ano. O pipeline já possui a estrutura de agregação, mas a
          carga ainda não foi validada contra os arquivos oficiais completos; por isso, indicadores da RAIS <strong>ainda não são exibidos</strong>.
          Devido ao volume (vários GB por ano), a carga completa está planejada para processamento distribuído (Parquet + PySpark).
        </p>
      </Section>

      <Section id="ibge" title="Territórios e classificações (IBGE)">
        <p>Nomes e códigos de UFs e municípios (API de Localidades), seções da CNAE 2.0 e malha territorial das UFs (API de Malhas, qualidade mínima, usada só para visualização).</p>
      </Section>

      <Section id="pipeline" title="Pipeline de dados">
        <ol className="list-decimal space-y-1 pl-5">
          <li><strong>Coleta autorizada</strong> apenas de domínios oficiais, com checksum SHA-256 de cada arquivo.</li>
          <li><strong>Validação</strong> do layout (colunas esperadas) e de cada registro (competência, UF, município, seção, tipo de movimentação). Importações com mais de 1% de rejeição são abortadas.</li>
          <li><strong>Normalização</strong> em camada curada (Parquet), já sem atributos pessoais.</li>
          <li><strong>Agregação</strong> por território, setor e ocupação, com verificação de consistência (soma das UFs ≤ total Brasil).</li>
          <li><strong>Carga</strong> no banco como conjunto “em revisão”, seguida de <strong>publicação</strong> por administrador.</li>
        </ol>
      </Section>

      <p className="text-sm text-muted-foreground">
        Encontrou uma inconsistência? <Link href="/contato" className="text-primary underline">Fale conosco</Link>.
      </p>
    </article>
  );
}
