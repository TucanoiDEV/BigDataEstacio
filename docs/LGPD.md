# LGPD e proteção de dados

> As páginas legais da aplicação (`/privacidade`, `/termos`, `/cookies`, `/seguranca`, `/central-de-privacidade`) são **minutas** e exibem o aviso de revisão jurídica. Campos `[PREENCHER]` vêm das variáveis `NEXT_PUBLIC_CONTROLLER_*`, `NEXT_PUBLIC_DPO_*` e `NEXT_PUBLIC_CONTACT_EMAIL` ou exigem decisão do controlador.

## Privacidade desde a concepção — o que o código faz

| Princípio (art. 6º) | Implementação |
|---|---|
| Necessidade/minimização | Cadastro só com nome, e-mail e senha. Sem CPF, data de nascimento ou dados sensíveis. Pipeline descarta sexo, raça/cor, idade, escolaridade e deficiência dos microdados. Admin não lista todos os usuários (busca com ≥ 3 caracteres). |
| Finalidade/transparência | Tabela de finalidades e bases legais na Política de Privacidade; tela de candidatura mostra exatamente o que será compartilhado. |
| Livre acesso | Exportação JSON imediata (`/api/conta/exportar`). |
| Qualidade | Edição de perfil, experiências e formação. |
| Segurança/prevenção | Ver [SEGURANCA.md](SEGURANCA.md). |
| Não discriminação | Recomendação sem atributos sensíveis; foto não é enviada às empresas; nenhuma decisão automatizada sobre candidatos; Termos proíbem discriminação. |
| Responsabilização | Auditoria, registro de consentimentos, registro de solicitações e incidentes. |

## Direitos do titular (art. 18)

| Direito | Como atender |
|---|---|
| Confirmação e acesso | Autoatendimento: exportação JSON. |
| Correção | Autoatendimento: perfil. |
| Portabilidade | Exportação JSON (formato estruturado). |
| Eliminação | Autoatendimento: excluir conta (anonimiza usuário, apaga perfil/arquivos/alertas, retira candidaturas em andamento e remove o recorte enviado às empresas). |
| Informação sobre compartilhamento / oposição / revogação | Central de Privacidade (solicitação com protocolo e prazo de 15 dias), preferências de comunicação e de cookies. |

Solicitações ficam em `PrivacyRequest` e são tratadas em `/admin/privacidade` com prazo, responsável e resposta visível ao titular. **Confirme a identidade** antes de entregar ou excluir dados por esse canal.

## Papéis

- **Plataforma**: controladora dos dados de conta, perfil, uso e segurança.
- **Empresa recrutadora**: recebe o recorte que o candidato confirmou compartilhar e, a partir daí, trata os dados como controladora para o processo seletivo (Termos de Uso, seção 4). A qualificação exata (controladoria independente ou conjunta) depende do modelo de negócio — **revisão jurídica necessária**.
- **Operadores**: hospedagem, banco, SMTP, antivírus, backup — listar na política e firmar contratos com cláusulas de proteção de dados.

## Cookies

- Necessários: sessão (`__Host-ea_session`) e escolha de cookies (`ea_consent`, base64url, 180 dias).
- Opcionais (análise/marketing): **nenhum ativo por padrão**. Se `NEXT_PUBLIC_ANALYTICS_SCRIPT_URL` for configurada, o script só carrega após consentimento de “Análise” (componente `OptionalScripts`). A CSP inclui automaticamente a origem do script.
- Banner com três botões de mesmo peso visual, sem caixas pré-marcadas, revogação no rodapé; cada escolha gera `ConsentRecord` (identificador pseudônimo com HMAC). Testado em E2E.
- Mantenha `COOKIE_INVENTORY` (`src/lib/consent.ts`) sincronizado com os cookies realmente usados. Mudanças de categoria exigem nova `LEGAL_VERSIONS.cookies` (o banner reaparece).

## Retenção (a definir pelo controlador)

| Dado | Sugestão | Implementado |
|---|---|---|
| Sessões e tokens expirados | Remover diariamente | `npm run jobs:maintenance` |
| Registros de acesso | 6 meses (Marco Civil, art. 15) | **Pendente**: hoje o IP é guardado apenas como HMAC; avaliar juridicamente a necessidade de IP em claro em armazenamento restrito e implementar expurgo. |
| Candidaturas encerradas | Ex.: 24 meses | **Pendente**: rotina de expurgo/anonimização por prazo. |
| Auditoria | Ex.: 5 anos | **Pendente**: rotina de expurgo. |
| Contas excluídas | Anonimização imediata | Implementado. |
| Backups | Ex.: 35 dias | Depende da infraestrutura. |

## Incidentes

Registro e acompanhamento em `/admin/incidentes` (severidade, dados afetados, avaliação de risco, necessidade e data de comunicação à ANPD e aos titulares). Procedimento: [RESPOSTA-A-INCIDENTES.md](RESPOSTA-A-INCIDENTES.md).

## Antes de publicar

- [ ] Revisão jurídica das minutas e preenchimento de controlador, DPO, fornecedores, transferência internacional, prazos e foro.
- [ ] Relatório de Impacto à Proteção de Dados (RIPD) — recomendável pelo volume de currículos.
- [ ] Contratos com operadores e com empresas recrutadoras.
- [ ] Implementar as rotinas de retenção pendentes.
