# Auditoria técnica — triagem e pendências

Atualizado em 26/10/2026 (itens 🔴, 🟠 e 🟡 concluídos, além do #4 e do #9; segunda rodada de robustez). Origem: auditoria externa de 26/10/2026 sobre a revisão `5c6429c` (main), com testes na interface local, suítes automatizadas e revisão estática.

Todos os achados foram conferidos contra a branch `feat/emprego-agora`. Os corrigidos estão marcados com ✅ e cobertos por [tests/integration/audit-regressions.test.ts](../tests/integration/audit-regressions.test.ts) e por testes unitários.

Legenda: 🔴 aplicar agora · 🟠 aplicar agora, depende de decisão · 🟡 próxima rodada · ⏳ futuro · ✅ concluído.

## Resumo da auditoria

- **Passou:** lint, typecheck, 32 testes unitários, 22 testes do pipeline, build (58 páginas), `npm audit` sem vulnerabilidades.
- **Não executado pela auditoria:** integração com PostgreSQL, E2E completo, SMTP/ClamAV reais, concorrência, backups e carga.
- **Testes diagnósticos que falharam (4):** `q` repetido lança ZodError; vaga pausada com PAYMENT_REQUEST volta como ACTIVE ao retomar; falha na notificação já avançou `lastSentAt`; falha SMTP é contada em `sent`.

## ✅ Concluído (antes 🔴 Aplicar agora)

| # | Achado | Onde | Correção acordada | Aceite |
|---|---|---|---|---|
| 1 ✅ | Retomar vaga pausada contorna a moderação | [jobs.ts](../src/server/services/jobs.ts) `changeJobLifecycle` | Ler `fraudSignals` antes de retomar; se houver sinais, ir para `PENDING_REVIEW` e chamar `warnModeration` | Pausar → editar com sinal → salvar → retomar retém a vaga; sem sinais retoma normalmente |
| 3 ✅ | Parâmetro repetido (`?q=a&q=b`) derruba `/vagas` | [validation/search.ts](../src/lib/validation/search.ts) `optionalString` / `parseJobSearch` | Normalizar array → primeiro valor; `safeParse` com fallback para filtros vazios | Parâmetros repetidos, vazios, longos e desconhecidos não causam erro de renderização (`q`, `city`, `empresa`) |
| 11 ✅ | "Áreas em alta" conta vagas expiradas | [services/search.ts](../src/server/services/search.ts) `trendingSectors` | Reutilizar a condição pública comum (inclui `closesAt`) | Vaga ACTIVE com `closesAt` no passado não entra nos contadores |
| 7 ✅ | "Salvar rascunho" altera vaga pública | [job-form.tsx](../src/components/company/job-form.tsx) | Rótulo por status: "Salvar alterações" + aviso quando ACTIVE | Texto e comportamento coincidem em DRAFT, ACTIVE, PAUSED e PENDING_REVIEW |
| 2 ✅ | Alertas perdem entregas após falha (versão mínima) | [alerts-job.ts](../src/server/services/alerts-job.ts) | Avançar `lastSentAt` só após a notificação; tratar retorno de `sendMailSafe` e contar `emailFailed` separadamente | Falha na notificação não avança o cursor; falha SMTP não conta como envio |
| 10 ✅ | Renovação da sessão não renova o cookie | [session.ts](../src/server/auth/session.ts) | Cookie com validade igual ao teto absoluto (90 dias); o banco segue como autoridade da expiração deslizante | Teste com relógio simulado comparando banco, Set-Cookie e teto absoluto |
| ✅ | Retirada de candidatura sem atomicidade | [applications.ts](../src/server/services/applications.ts) (~L145) | Envolver status + histórico em `db.$transaction` | Falha na segunda gravação reverte as duas |
| ✅ | Recomendação para perfil vazio ("0 de 4" com marca positiva) | Recomendações (UI) | Exibir "Complete seu perfil para melhorar as sugestões"; separar compatibilidades de lacunas | Perfil 0% não mostra marca positiva |

## ✅ Decisões tomadas e aplicadas (antes 🟠)

| # | Achado | Decisão aplicada |
|---|---|---|
| 5 ✅ | Filtro "a partir de R$ X" comparava o teto da faixa | Compara o piso: `COALESCE(salaryMin, salaryMax) >= X`. Faixas que só cruzam o valor deixam de aparecer |
| 8 ✅ | Domínio/contato da empresa mudavam sem revalidação | Empresa VERIFIED volta para PENDING quando muda o **domínio** do site (`www.` e caminho são ignorados) ou o e-mail de contato. A moderação é notificada, e o formulário e a mensagem de retorno avisam que as vagas saem do ar até a aprovação. Campos descritivos seguem livres |

## ✅ Concluído na segunda rodada (antes 🟡)

| # | Achado | Abordagem |
|---|---|---|
| 6 ✅ | No celular, filtros empurravam o primeiro card para ~1.340 px | Painel recolhível com contador de filtros ativos; no celular, aplica só em "Aplicar filtros" e volta ao topo. Primeiro card agora a ~667 px (Pixel 7). Teste E2E em `responsive.spec.ts` |
| 12 ✅ | Menu móvel mostrava "Entrar"/"Criar conta" com sessão ativa | O menu móvel vem do `UserMenu` (servidor): visitante vê entrar/criar conta; com sessão, conta, candidaturas, empresas, administração e "Sair". "Close" traduzido para "Fechar". Teste E2E |
| 4 ✅ | Busca de cidade dependia de acentos ("Sao Paulo" ≠ "São Paulo") | Resolvido na busca unificada: a cidade é comparada sem acento e sem caixa nas duas origens (`translate`/`cityNormalized`). O autocomplete com código IBGE continua como evolução |

**Também concluído:** #9 ✅. Ao renomear a empresa, `updateOrganization` reconstrói o `searchText` de todas as vagas dela na mesma transação.

## ⏳ Futuro

### Robustez e concorrência (validar com PostgreSQL real / integração)

- **Alertas — versão completa:** outbox transacional, tentativas com atraso, chave de idempotência, estado de entrega por canal e bloqueio de execução concorrente do mesmo alerta. "Último envio" exibido só quando corresponder ao canal.
- ✅ **Exclusão de conta:** conferência de propriedade, anonimização e marcação dos arquivos numa transação; arquivos removidos do disco só depois de confirmada. Logo de empresa em uso é preservado (perde só o vínculo com a pessoa). ~~Antes: os arquivos eram apagados antes da anonimização ([privacy.ts](../src/server/services/privacy.ts) ~L117). Usar estado de exclusão e fila idempotente; verificar também logos de organização enviados pelo usuário.~~
- ✅ **Empresa sem proprietário:** alterações de vínculos (e a exclusão de conta) travam a linha da empresa (`FOR UPDATE`) e contam proprietários dentro da transação. Teste com 6 proprietários saindo ao mesmo tempo: no código antigo todos saíam; agora sempre resta um.
- ✅ **Convites:** o aceite condiciona `acceptedAt`, `revokedAt` e `expiresAt` na mesma gravação. Teste de aceite e revogação simultâneos (no código antigo, o convite ficava aceito e revogado ao mesmo tempo).
- **IP para rate limiting:** [request.ts](../src/server/security/request.ts) confia em cabeçalhos encaminhados; validar contra o proxy real e cabeçalhos forjados.
- **Recomendações limitadas às 300 vagas mais recentes:** pré-filtrar candidatos por critérios relevantes antes do score (só relevante com volume real).
- **Versão de rascunho separada da publicada** (evolução do item 7).
- **Autocomplete de município com código IBGE + UF** (evolução do item 4) e opção explícita para incluir vagas remotas ao filtrar UF.
- ✅ Campo de encerramento (`closesAt`) no formulário de vaga: data opcional (até o fim do dia, horário de Brasília), entre hoje e um ano; pode ser removida na edição.

### Produto

- **Observatório:** seletor de período, comparação entre territórios, exportação CSV com fonte, competência e data de extração. Não misturar saldo do CAGED com quantidade de vagas.
- **Qualidade dos dados:** reconciliar agregados importados com totais oficiais, alertar sobre atualização atrasada, preservar versões/revisões.
- **Recrutamento:** busca e paginação nas candidaturas, filtros por etapa, indicador de tempo sem resposta; evitar carregar listas inteiras.
- ✅ **Demonstração:** selo nos cards e na página da vaga; vagas fictícias fora do sitemap e sem `JobPosting`. Estratégia de vagas reais em [VAGAS-REAIS.md](VAGAS-REAIS.md).

### Preparação de produção (já reconhecidos em STATUS.md)

ClamAV real, retenção e limpeza, monitoramento, backups testados, revisão jurídica das minutas e política de rotação de chaves.

## Ordem sugerida

1. ~~Itens 🔴, cada um com teste cobrindo o caso da auditoria.~~ ✅
2. ~~Decisões 🟠 e implementação.~~ ✅
3. ~~Itens 🟡 (mobile primeiro: 6 e 12).~~ ✅
4. Bloco ⏳ de robustez, junto com a suíte de integração em PostgreSQL.
5. Produto e preparação de produção.
