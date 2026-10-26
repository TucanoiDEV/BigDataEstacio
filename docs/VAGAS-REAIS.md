# Vagas reais — estratégia híbrida

Atualizado em 26/10/2026.

O site combina duas origens de vagas **numa lista única**: a busca, a ordenação, a paginação e as contagens tratam as duas da mesma forma. Cada card externo leva o selo "Vaga externa" e o crédito da fonte.

| | Empresas verificadas | Outros sites |
|---|---|---|
| Origem | Empresas cadastradas na plataforma | Adzuna (API oficial) e quadros públicos do Greenhouse |
| Verificação | CNPJ, domínio e moderação contra golpes | Nenhuma pela plataforma; Adzuna passa pela mesma triagem automática de golpes |
| Candidatura | Na plataforma (acompanhamento de status, histórico, LGPD) | No site de origem (link externo) |
| Alertas | Sim | Sim (vaga nova = chegou à plataforma depois do último aviso; o link abre o site de origem) |
| Recomendações | Sim | Não: as fontes não informam competências nem senioridade |
| Onde aparece | `/vagas`, "Oportunidades recentes" e contadores da página inicial, páginas das empresas | `/vagas`, "Oportunidades recentes" e contadores da página inicial |

As vagas da **Empresa Demonstração** (seed de desenvolvimento) exibem o selo "Demonstração", não entram no sitemap e não geram dados estruturados `JobPosting` para buscadores.

## 1. Vagas externas

### Como funciona

- Tabela `ExternalJob`, separada de `Job`. Vagas externas não têm empresa, candidatura nem moderação na plataforma.
- `npm run jobs:external` importa as fontes configuradas. A tarefa agendada **"Vagas externas (diario)"** roda às 07:00 (veja `scripts/agendamento/registrar-tarefas.ps1`; rode o script de novo para registrar a tarefa nova).
- Código: [external-sources.ts](../src/server/services/external-sources.ts) (adaptadores), [external-jobs.ts](../src/server/services/external-jobs.ts) (gravação, desativação e busca), [lib/external-jobs.ts](../src/lib/external-jobs.ts) (normalização).

**Regras de qualidade e segurança:**
- Texto externo é tratado como não confiável: tags HTML removidas, renderizado como texto.
- Links só em `https`. Na Adzuna, apenas os domínios `adzuna.com.br` e `adzuna.com`.
- Vagas fora do Brasil são descartadas pela localização. O interpretador entende formatos como:
  - "Sao Paulo, Sao Paulo, Brasil" e "São Paulo-SP";
  - "Curitiba or São Paulo | On-site";
  - "Brazil (Remote)" e "Brazil (São Paulo - Hybrid)";
  - nomes de cidade sozinhos, como "Paranaguá".

  As cidades são reconhecidas pela lista de municípios do IBGE, a mesma do observatório, com as capitais como base quando essa lista não está importada. Homônimos estrangeiros, como "Barcelona" e "Miami, Florida", são barrados por uma lista de países e cidades estrangeiras.
- Vagas da Adzuna com sinais de golpe (cobrança de taxa, contato só por WhatsApp etc.) não são importadas.
- Salário estimado pela Adzuna não é exibido: os termos exigiriam o selo "Adzuna Jobsworth".
- Ciclo de vida:
  - Greenhouse: o quadro vem completo, então a vaga que some dele é desativada na hora.
  - Adzuna: a vaga sai do ar se não for revista em 7 dias ou se tiver sido publicada há mais de 45.
  - Vagas inativas são apagadas após 90 dias.
- Uma fonte com falha não interrompe as outras e não desativa as vagas que já estavam gravadas.

### Configuração (`.env`)

```env
# Adzuna — cadastro gratuito em https://developer.adzuna.com
ADZUNA_APP_ID=...
ADZUNA_APP_KEY=...
ADZUNA_QUERIES=analista,assistente,desenvolvedor,estágio   # vazio = mais recentes
ADZUNA_MAX_PAGES=4                                          # 50 vagas por página

# Greenhouse — token do quadro (a parte depois de job-boards.greenhouse.io/) e nome exibido
GREENHOUSE_BOARDS=stone:Stone,quintoandar:QuintoAndar
```

**Orçamento da Adzuna:** o plano gratuito permite 25 chamadas por minuto e 250 por dia. Cada termo consome até `ADZUNA_MAX_PAGES` chamadas. Com 4 termos × 4 páginas, a importação diária usa 16 chamadas. O importador espera cerca de 2,6 s entre chamadas.

**Para encontrar quadros do Greenhouse:** abra a página de carreiras da empresa. Se o link de uma vaga levar a `job-boards.greenhouse.io/<token>/…` ou `boards.greenhouse.io/<token>`, o token é o que vem depois da barra. Confira em `https://boards-api.greenhouse.io/v1/boards/<token>/jobs`.

### Quadros configurados (26/10/2026)

Quadros testados em 26/10/2026: **1.454 vagas no Brasil**, de 17 empresas.

| Token | Empresa | Vagas no Brasil |
|---|---|---|
| `stone` | Stone | 373 |
| `btgpactual` | BTG Pactual | 262 |
| `c6bank` | C6 Bank | 165 |
| `inter` | Banco Inter | 152 |
| `xpinc` | XP Inc. | 129 |
| `quintoandar` | QuintoAndar | 89 |
| `agibank` | Agibank | 80 |
| `arcoeducacao` | Arco Educação | 49 |
| `gympass` | Wellhub | 38 |
| `ebanx` | EBANX | 26 |
| `vtex` | VTEX | 19 |
| `jusbrasil` | Jusbrasil | 17 |
| `bancopan` | Banco PAN | 16 |
| `wildlifestudios` | Wildlife Studios | 15 |
| `getnet` | Getnet | 10 |
| `cortex` | Cortex | 7 |
| `rdstation` | RD Station | 7 |

Quadros que existem mas ficaram de fora por terem 1 vaga no Brasil ou nenhuma: `thoughtworks`, `blip`, `clara`, `flash`, `nubank`, `pagarme`. Os números mudam a cada dia.

> **Depois de puxar esta branch:** rode `npx prisma migrate dev` (cria a tabela `ExternalJob` e o campo `isDemo`) e **reinicie o `npm run dev`**. Um servidor de desenvolvimento aberto antes da migration continua com o cliente antigo do Prisma na memória, e as páginas `/` e `/vagas` quebram com `PrismaClientValidationError`.

### Termos de uso — conferir antes de publicar

- **Adzuna** ([termos](https://developer.adzuna.com/docs/terms_of_service)):
  - Publicar anúncios e fazer pesquisa acadêmica são usos permitidos.
  - Cada vaga exibida precisa do crédito "Adzuna" com no mínimo 116 × 23 px e link para o domínio local. Isso já está implementado no card.
  - Uso por organização comercial, governamental ou acadêmica tem **teste de 14 dias**. Depois disso, ou se o site gerar receita, é preciso **licença ou acordo por escrito**.
  - Os termos podem mudar. Confira a versão vigente e, para um projeto acadêmico público, registre o acordo por e-mail com a Adzuna.
- **Greenhouse:** a API de quadros (Job Board API) é pública e foi feita para exibir vagas fora do Greenhouse. Mesmo assim, é recomendável avisar cada empresa listada, ou pedir autorização, antes de exibir o quadro dela.
- **Não usar raspagem** de sites sem API pública (Gupy, LinkedIn, Indeed, Vagas.com etc.).

### Pendências conhecidas

- Uma vaga pode aparecer duas vezes se vier pela Adzuna e pelo Greenhouse.
- Vagas externas não entram nas recomendações nem em "Áreas em alta", porque as fontes não informam setor, competências ou senioridade.
- Filtros de contratação, senioridade, setor e empresa deixam as vagas externas de fora, porque a fonte não informa esses dados. É a mesma regra do filtro de salário para vagas da plataforma com salário oculto.
- Não há tela de administração das fontes: a configuração fica no `.env`, e o resultado de cada execução fica no log da tarefa agendada.
- Nomes de cidades ficam como vêm da fonte, às vezes sem acento ("Sao Paulo"). A busca já ignora acentos.

## 2. Piloto com empresas reais

O fluxo de cadastro e verificação já existe: `/empresa/nova` → fila em `/admin/empresas` → publicação de vagas. O que falta é operação.

### Antes de convidar empresas (bloqueante)

Itens de [STATUS.md](STATUS.md) e [AUDITORIA-PENDENCIAS.md](AUDITORIA-PENDENCIAS.md):

- [ ] Site publicado com domínio próprio e HTTPS ([DEPLOY.md](DEPLOY.md))
- [ ] SMTP real, para verificação de e-mail, alertas e avisos de candidatura
- [ ] ClamAV ativo: sem ele, os uploads de currículo são recusados em produção
- [ ] Backups testados (fazer e restaurar)
- [ ] Revisão jurídica das minutas (termos e privacidade) e preenchimento dos dados do controlador (`NEXT_PUBLIC_CONTROLLER_*`, `NEXT_PUBLIC_DPO_*`)
- [ ] Banco de produção **sem** o seed de demonstração (`db:seed:demo` só em desenvolvimento)

### Roteiro sugerido

1. **Selecionar de 5 a 10 empresas.** Por exemplo: parceiras da central de carreiras e de estágios da Estácio, associações comerciais locais e o SINE ou a prefeitura.
2. **Verificar cada cadastro** em `/admin/empresas`:
   - CNPJ ativo na Receita;
   - domínio do site compatível com o e-mail de contato;
   - pessoa responsável identificada.
3. **Acompanhar as primeiras vagas** na moderação (`/admin/vagas`) e orientar sobre a descrição: faixa salarial, requisitos e benefícios.
4. **Medir por 30 dias:** vagas publicadas, candidaturas por vaga, tempo até a primeira resposta da empresa, vagas retidas pela moderação.
5. **Ajustar e ampliar.** Com o piloto estável, as vagas da plataforma passam a ser a aba principal, e as externas ficam como complemento.
