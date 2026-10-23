# Emprego Agora

Plataforma brasileira de vagas de emprego com **observatório do mercado de trabalho** baseado em dados oficiais (Novo CAGED, PNAD Contínua/IBGE). Candidatos encontram vagas de empresas verificadas e acompanham cada etapa das candidaturas; empresas publicam vagas e gerenciam o recrutamento em equipe; administradores moderam a plataforma e atendem solicitações de privacidade.

> **Situação:** produto funcional, testado de ponta a ponta em ambiente local. **Não** está pronto para produção sem os itens listados em [docs/STATUS.md](docs/STATUS.md) (revisão jurídica, infraestrutura, antivírus em produção, pentest). Veja o que está pronto, demonstrativo e pendente nesse documento.

## Stack

| Camada | Tecnologia |
|---|---|
| Aplicação | Next.js 16 (App Router, Cache Components, Server Actions), React 19, TypeScript strict |
| UI | Tailwind CSS 4, shadcn/ui (Radix), Lucide, Recharts, d3-geo |
| Dados | PostgreSQL 17, Prisma 7 (driver adapter `pg`), migrações versionadas |
| Validação/forms | Zod 4, React Hook Form |
| Autenticação | Sessões próprias em banco (cookie HttpOnly), Argon2id, TOTP (MFA) — ver [docs/SEGURANCA.md](docs/SEGURANCA.md) |
| Testes | Vitest (unidade + integração com Postgres real), Playwright + axe (E2E/acessibilidade), pytest (pipeline) |
| Pipeline de dados | Python 3.11+, Polars, Parquet, psycopg; preparado para PySpark |
| Infra local | Docker Compose: PostgreSQL, Mailpit (e-mail), ClamAV (opcional) |

## Início rápido

Pré-requisitos: Node.js 22+ (testado com 24), Docker, Python 3.11+ (apenas para o pipeline).

```bash
cp .env.example .env
# gere as duas chaves e cole em ENCRYPTION_KEY e HASH_PEPPER:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

docker compose up -d postgres mailpit       # Postgres em localhost:5433, Mailpit em http://localhost:8025
npm install                                 # também gera o Prisma Client
npm run db:migrate                          # aplica as migrações
npm run db:seed:demo                        # (opcional) dados FICTÍCIOS de demonstração
npm run dev                                 # http://localhost:3000
```

Contas do seed de demonstração (somente desenvolvimento): `candidata.demo@exemplo.test` e `recrutador.demo@exemplo.test`, senha exibida ao rodar o seed.

Administrador da plataforma (não existe tela para conceder esse papel):

```bash
ADMIN_INITIAL_PASSWORD="uma frase longa e unica" npm run admin:create -- --email voce@empresa.com --name "Seu Nome"
```

Os e-mails (confirmação de conta, redefinição de senha, notificações) aparecem no Mailpit em http://localhost:8025.

### Dados oficiais do observatório

```bash
cd data-pipeline
python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"   # Linux/macOS: .venv/bin/pip
.venv/Scripts/python -m emprego_pipeline ibge                       # territórios, CNAE, CBO, malha das UFs
.venv/Scripts/python -m emprego_pipeline pnad                       # desocupação (PNAD Contínua)
.venv/Scripts/python -m emprego_pipeline caged --de 202509 --ate 202608   # ~650 MB de download
```

Cada importação entra como **“em revisão”**; publique em **/admin/dados**. Detalhes em [docs/FONTES-DE-DADOS.md](docs/FONTES-DE-DADOS.md).

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Desenvolvimento, build de produção, servidor de produção |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run test:unit` | Testes de unidade (sem banco) |
| `npm run test:integration` | Testes de integração no banco `TEST_DATABASE_URL` (limpo a cada execução) |
| `npm run test:e2e` | Build + Playwright (fluxo completo, segurança, cookies, acessibilidade, mobile) |
| `npm run db:migrate` / `db:migrate:dev` | Aplica migrações / cria nova migração |
| `npm run admin:create` | Cria/promove administrador |
| `npm run jobs:alerts` / `jobs:maintenance` | Tarefas agendadas (cron): alertas por e-mail; limpeza de sessões/tokens expirados |
| `cd data-pipeline && pytest` | Testes do pipeline |

## Estrutura

```
src/
  app/                 rotas (páginas, Server Actions em app/actions, API em app/api)
  components/          UI (ui/ = shadcn), formulários, gráficos, layout
  lib/                 código isomórfico: validação (Zod), regras puras (recomendação, fraude, status), formatação
  server/              somente servidor: auth (sessão + DAL), autorização, serviços de domínio, segurança, e-mail, storage
  generated/prisma/    Prisma Client (gerado)
prisma/                schema, migrações SQL, seed de demonstração
data-pipeline/         ingestão de dados oficiais (Python)
tests/                 integração (Vitest) e E2E (Playwright)
docs/                  arquitetura, segurança, LGPD, fontes de dados, deploy, status, incidentes
```

## Documentação

- [Arquitetura](docs/ARQUITETURA.md)
- [Segurança](docs/SEGURANCA.md)
- [LGPD e privacidade](docs/LGPD.md)
- [Fontes de dados e pipeline](docs/FONTES-DE-DADOS.md)
- [Deploy e operação](docs/DEPLOY.md)
- [Resposta a incidentes](docs/RESPOSTA-A-INCIDENTES.md)
- [Status de implementação](docs/STATUS.md)
