# Status de implementação

Atualizado em 23/10/2026. Legenda: ✅ pronto e testado · 🟡 pronto, com ressalva/demonstrativo · ⏳ pendente.

## Verificações executadas nesta entrega

| Verificação | Resultado |
|---|---|
| `npm run lint` (ESLint) | ✅ sem erros nem avisos |
| `npm run typecheck` (TypeScript strict) | ✅ sem erros |
| `npm run test:unit` | ✅ 32 testes (TOTP com vetores RFC 6238, CNPJ, senha, redação, fraude, recomendação, permissões, validação, PDFs, consentimento) |
| `npm run test:integration` (PostgreSQL real) | ✅ 24 testes (cadastro, login, bloqueio, MFA sem reuso, redefinição de senha, IDOR entre empresas, elevação de papéis, convites, fluxo de contratação, busca com entrada maliciosa, exportação/exclusão LGPD, uploads, alertas) |
| `npm run test:e2e` (Playwright, build de produção) | ✅ 21 testes (fluxo completo pela interface, cabeçalhos, flags do cookie, IDOR, admin, banner de cookies, páginas legais, axe em 6 páginas, mobile sem rolagem horizontal) |
| `pytest` (pipeline) | ✅ 22 testes |
| `npm audit` | ✅ 0 vulnerabilidades conhecidas |
| `next build` | ✅ 58 rotas (pré-render parcial) |
| `docker build` + execução | ✅ imagem sobe, `/api/health` ok, roda como usuário sem privilégios |
| Importação real Novo CAGED + IBGE | ✅ 52,6 milhões de registros (09/2025–08/2026), 0 rejeitados; publicação feita pela tela de admin |

## Por fase

### Fase 1 — Base, segurança, privacidade
- ✅ Projeto Next.js 16/TS strict, design system (tokens, componentes), layout responsivo, estados de carregamento/erro/vazio.
- ✅ Autenticação própria: cadastro, verificação de e-mail, login, recuperação, troca de senha, sessões revogáveis, MFA TOTP (obrigatório para admin em produção).
- ✅ Rate limiting, antienumeração, bloqueio por tentativas, cabeçalhos de segurança, CSP (🟡 com `'unsafe-inline'` em scripts — ver SEGURANCA.md).
- ✅ Banner de cookies (aceitar/rejeitar/personalizar equivalentes), registro e revogação de consentimento, inventário.
- 🟡 Páginas legais completas como **minutas** — exigem revisão jurídica e preenchimento de dados do controlador.

### Fase 2 — Perfis, organizações, vagas
- ✅ Perfil profissional (experiências, formação, competências, preferências, foto, visibilidade de contato).
- ✅ Empresas: cadastro com validação de CNPJ, verificação pela moderação, perfil, logo, membros com papéis, convites.
- ✅ Vagas: rascunho, publicação, edição, pausa, encerramento; retenção automática por sinais de fraude.
- ✅ Busca com palavra-chave, UF, município, salário, senioridade, setor, contratação, modalidade, ordenação e paginação; páginas de vaga com JSON-LD apenas para vagas ativas; sitemap e robots.
- ✅ Data de encerramento da vaga: campo "Inscrições até" no formulário (opcional, até um ano); a vaga sai da busca após a data.
- ⏳ Busca de talentos para empresas (a preferência de visibilidade é armazenada; a interface informa que a busca ainda não existe).

### Fase 3 — Candidaturas, currículos, alertas, painéis
- ✅ Candidatura com escolha de currículo e consentimento explícito do que é compartilhado; sem duplicidade; histórico de status; retirada pelo candidato.
- ✅ Etapas Enviada → Em análise → Entrevista → Aprovada/Recusada (+ Retirada), com mensagens ao candidato, notas internas, notificações e e-mails conforme preferências.
- ✅ Currículos PDF com verificação de conteúdo e armazenamento privado; download autorizado e auditado.
- 🟡 Antivírus: cliente `clamd` implementado e integrado (falha fechada em produção), mas **não executado contra um ClamAV real** nesta entrega.
- ✅ Vagas salvas, alertas por e-mail (tarefa agendada), notificações internas.
- ✅ Painel do candidato com recomendações explicáveis; painel da empresa com indicadores e quadro por etapas; painel administrativo (moderação, denúncias, usuários, auditoria, LGPD, incidentes, dados).

### Fase 4 — Observatório
- ✅ Pipeline Novo CAGED (coleta autorizada, validação, curadoria Parquet, agregação, carga, publicação), IBGE (territórios, CNAE, malha, PNAD).
- ✅ Atualização automática agendada (`atualizar --publicar`): detecta competência/trimestre novo, reimporta a janela de 12 meses e publica só se aprovado nos portões de qualidade; testada sem novidade (no-op) e com reprocessamento forçado (publicação automática + auditoria). Tarefas registradas no Agendador do Windows desta máquina.
- ✅ Painel com admissões, desligamentos, saldo, evolução mensal, mapa por UF, ranking de municípios, setores, ocupações, salário mediano, desocupação; fonte/metodologia em cada bloco; estado vazio sem dados publicados.
- ⏳ RAIS: módulo estruturado, **não validado** com arquivo real e não exibido.
- ⏳ Reconciliação automática com os totais publicados pelo MTE; histórico 2020–2025.

### Fase 5 — Testes, acessibilidade, hardening, deploy
- ✅ Suítes de unidade, integração, E2E, acessibilidade (axe) e pipeline; CI configurada (`.github/workflows/ci.yml`, não executada no GitHub nesta sessão).
- ✅ Dockerfile, Compose, health check, documentação de deploy/backup.
- ⏳ Teste de intrusão independente; monitoramento/alertas em produção; rotinas de retenção (candidaturas antigas, auditoria, registros de acesso); rotação de `ENCRYPTION_KEY`.

## Conteúdo demonstrativo

- `npm run db:seed:demo` cria **dados fictícios** (empresa “Empresa Demonstração”, 6 vagas com aviso de demonstração na descrição e duas contas). Recusa execução em produção. Nunca cria dados do observatório.
- Os testes E2E/integração usam o banco `emprego_agora_test`, limpo a cada execução.

## Antes de produção (bloqueantes)

1. Revisão jurídica das minutas, RIPD, contratos com operadores e empresas.
2. Infra: HTTPS, banco gerenciado com backup cifrado, armazenamento de arquivos, ClamAV, SMTP com DKIM/SPF, monitoramento.
3. Executar o ClamAV real e um pentest; corrigir achados.
4. Implementar rotinas de retenção e decidir a guarda de registros de acesso (Marco Civil).
