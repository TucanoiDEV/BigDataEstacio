# Arquitetura

## Visão geral

```
Navegador ──HTTPS──▶ Next.js (App Router)
                      ├─ proxy.ts ............ redireciona áreas privadas sem cookie (verificação otimista)
                      ├─ páginas (RSC) ....... shell estático + conteúdo dinâmico em <Suspense>
                      ├─ Server Actions ...... mutações (validação Zod + autorização no servidor)
                      ├─ Route Handlers ...... /api/arquivos, /api/conta/exportar, /api/health
                      └─ src/server/ ......... DAL, serviços de domínio, segurança, e-mail, storage
                               │
                               ├─▶ PostgreSQL (Prisma 7 + driver adapter pg)
                               ├─▶ Armazenamento privado de arquivos (STORAGE_DIR)
                               ├─▶ clamd (ClamAV) ─ antivírus de uploads
                               └─▶ SMTP ─ e-mails transacionais

data-pipeline/ (Python, fora da aplicação web)
  FTP MTE / APIs IBGE ─▶ raw/ (SHA-256) ─▶ curated/ (Parquet, sem atributos pessoais)
                                          ─▶ aggregates/ (Parquet) ─▶ PostgreSQL (Stat*, "em revisão")
                                                                    ─▶ admin publica ─▶ observatório
```

## Camadas do código

| Camada | Pasta | Regras |
|---|---|---|
| Rotas e UI | `src/app`, `src/components` | Não acessam o banco diretamente para decisões de acesso; chamam a DAL/serviços. |
| Server Actions | `src/app/actions/*` | Envolvidas por `createAction` (Zod + tratamento de erros sem vazar detalhes). Sempre resolvem o usuário pela sessão. |
| DAL (auth) | `src/server/auth/dal.ts` | Única fonte de identidade: `requireUser`, `assertOrgPermission`, `requirePlatformAdmin`… |
| Autorização | `src/server/authz/permissions.ts` | Matriz papel → permissão por organização; regras de concessão de papéis. |
| Serviços | `src/server/services/*` | Regras de negócio. Toda consulta de recurso de empresa é filtrada por `orgId` vindo da DAL (anti-IDOR). |
| Regras puras | `src/lib/*` | Validação, recomendação, fraude, transições de status — testadas em unidade. |

## Renderização (Cache Components)

O projeto usa `cacheComponents` + `partialPrefetching` do Next 16:

- Cada página é um **shell estático** (títulos, filtros, esqueletos de carregamento) e o conteúdo que lê sessão, `searchParams` ou banco fica dentro de `<Suspense>` — isso também fornece os estados de carregamento.
- Dados do banco **não** usam `'use cache'`: evita que o build dependa de um banco de produção acessível e garante dados sempre atuais. Otimização futura: `'use cache'` + `cacheTag` para listagens públicas (vagas recentes, observatório) com invalidação nas Server Actions.

## Modelo de dados (resumo)

- **Identidade**: `User`, `Session` (hash do token), `VerificationToken`, `MfaRecoveryCode`, `RateLimitBucket`.
- **Candidato**: `CandidateProfile`, `Experience`, `Education`, `Skill`/`ProfileSkill`, `Resume` → `StoredFile`.
- **Empresas**: `Organization` (status de verificação), `OrgMembership` (papel), `OrgInvitation`.
- **Recrutamento**: `Job` (+ `JobSkill`, `searchText` com índice GIN pg_trgm), `Application` (recorte do perfil em `profileSnapshot`, único por vaga+candidato), `ApplicationStatusChange`, `SavedJob`, `JobAlert`, `Notification`.
- **Privacidade/governança**: `CommunicationPreference`, `ConsentRecord`, `PrivacyRequest`, `Report`, `AuditLog`, `SecurityIncident`.
- **Observatório**: `StatTerritory`, `StatClassification`, `DataImport`, `StatDataset` (STAGED/PUBLISHED/ARCHIVED), `StatEmploymentFlow`, `StatIndicator`, `StatEmploymentStock` (RAIS, ainda sem carga).

Restrições adicionais em SQL (`prisma/migrations/*_search_and_constraints`): faixas salariais, CNPJ com 14 dígitos, e-mail minúsculo, datas coerentes, um currículo padrão por candidato, `saldo = admissões − desligamentos`.

## Recomendação de vagas

`src/lib/recommendation.ts` — função pura e determinística. Pesos: competências 40, localização/modalidade 20, interesses (cargo/setor) 15, senioridade 12, pretensão salarial 7, contratação 6. Retorna pontuação, **motivos** e **lacunas** exibidos ao candidato. Usa somente dados profissionais declarados; não usa (nem coleta) atributos sensíveis; apenas ordena sugestões para o candidato, nunca filtra candidaturas.

## Moderação antifraude

`src/lib/fraud.ts` — heurísticas (cobrança de taxas, contato só por mensageiro, ganho fácil, pedido de documentos/dados bancários, links encurtados, salário incompatível). Vagas com sinais vão para `PENDING_REVIEW` e só são publicadas após aprovação humana em `/admin/vagas`.

## Evolução planejada (Big Data)

- A camada `curated/` em Parquet já é o formato de entrada para PySpark. Para a RAIS completa (vários GB/ano) e séries históricas longas, executar a mesma lógica de `caged.py`/`rais.py` como jobs Spark lendo/escrevendo em armazenamento de objetos (S3/MinIO), mantendo a carga final dos agregados no PostgreSQL.
- Para maior volume de busca de vagas: mover a busca para um índice dedicado (OpenSearch/Meilisearch) alimentado por eventos de publicação.
