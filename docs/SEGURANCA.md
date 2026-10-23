# Segurança

Este documento descreve os controles **implementados e testados** no código, as decisões tomadas e o que ainda depende de infraestrutura ou de verificação externa. Ele não afirma que o sistema é seguro para produção: veja [STATUS.md](STATUS.md).

## Autenticação

| Controle | Implementação | Onde | Teste |
|---|---|---|---|
| Hash de senha | Argon2id (m=19 MiB, t=2, p=1 — OWASP) via `@node-rs/argon2` | `src/server/security/password.ts` | integração `auth.test.ts` |
| Política de senha | ≥ 10 caracteres, bloqueia senhas comuns, repetições e partes do nome/e-mail (NIST 800-63B) | `src/lib/password-policy.ts` | unidade |
| Sessão | Token aleatório de 256 bits em cookie `__Host-ea_session` (HttpOnly, Secure, SameSite=Lax, Path=/). No banco fica só o SHA-256. Expiração deslizante de 30 dias, teto de 90 dias; revogável pelo usuário | `src/server/auth/session.ts` | integração + E2E (flags do cookie) |
| Por que não Auth.js | O provedor de credenciais do Auth.js exige sessões JWT, que não podem ser revogadas no servidor; o requisito de revogação de sessões, MFA e bloqueio de contas suspensas levou a sessões próprias em banco | — | — |
| Verificação de e-mail | Token de uso único (24 h), hash no banco, confirmação por **POST** (scanners de link não consomem o token) | `services/auth.ts`, `/verificar-email/confirmar` | integração |
| Recuperação de conta | Token de uso único (1 h); emitir novo invalida os anteriores; redefinir invalida **todas** as sessões e avisa por e-mail | `services/auth.ts` | integração |
| Antienumeração | Cadastro, recuperação e reenvio respondem igual exista ou não o e-mail; login com mensagem genérica e verificação Argon2 "fictícia" para equalizar tempo | `services/auth.ts` | integração |
| Força bruta | Limites por IP e por e-mail (PostgreSQL, atômico); bloqueio de 15 min após 10 falhas | `security/rate-limit.ts` | integração |
| MFA | TOTP (RFC 6238), segredo cifrado com AES-256-GCM, tolerância ±30 s, **sem reutilização de código** (contador persistido), 10 códigos de recuperação de uso único (hash). Obrigatório para administradores quando `REQUIRE_ADMIN_MFA` (padrão: produção) | `security/totp.ts`, `services/auth.ts`, `auth/dal.ts` | unidade (vetores RFC) + integração |

## Autorização

- **Toda** decisão de acesso é feita no servidor pela DAL (`src/server/auth/dal.ts`). O `proxy.ts` só faz redirecionamento otimista.
- Papéis da plataforma: `USER`, `PLATFORM_ADMIN` (concedido apenas via CLI `npm run admin:create`).
- Papéis por empresa: `OWNER`, `ADMIN`, `RECRUITER`, `VIEWER` (`src/server/authz/permissions.ts`). Ninguém concede papel acima do próprio; só `OWNER` cria `OWNER`; a empresa nunca fica sem `OWNER`; ninguém altera o próprio papel.
- **IDOR**: consultas de recursos de empresa são sempre filtradas por `orgId` obtido da associação validada, nunca só pelo ID do recurso. Candidatos só acessam as próprias candidaturas. Respostas negadas usam 404 para não revelar existência. Coberto em `tests/integration/authorization.test.ts` e E2E.
- Convites valem só para o e-mail convidado, expiram em 7 dias e são de uso único.

## Entrada, saída e web

- Validação Zod no servidor em todas as Server Actions (`createAction`) e parâmetros de URL; os mesmos schemas validam no cliente.
- SQL: Prisma ou `Prisma.sql` parametrizado; curingas de `LIKE` escapados. Teste de injeção em `hiring-flow.test.ts`.
- XSS: o conteúdo de usuários é renderizado como texto pelo React; não há HTML de usuário. Único `dangerouslySetInnerHTML`: JSON-LD gerado pelo servidor com `<` escapado.
- CSRF: Server Actions verificam `Origin` × `Host` (Next.js); cookies `SameSite=Lax`; route handlers de leitura apenas (GET).
- Open redirect: parâmetro `next` aceita só caminhos internos (`safeNextPath`, testado).
- Cabeçalhos (`next.config.ts`): CSP, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP; HSTS e `upgrade-insecure-requests` quando `APP_URL` é HTTPS. Áreas autenticadas com `Cache-Control: private, no-store` e `X-Robots-Tag: noindex`.
- **Limitação conhecida da CSP**: `script-src` inclui `'unsafe-inline'` porque o App Router injeta scripts inline e nonces exigiriam renderização 100% dinâmica (perdendo o pré-render parcial). Mitigação atual: nenhuma renderização de HTML de usuário, `object-src 'none'`, `base-uri`/`form-action` restritos. Evolução: avaliar SRI/hashes (experimental no Next) ou nonces nas rotas autenticadas.

## Arquivos (currículos, fotos, logos)

1. Limite de tamanho (5 MB PDF / 2 MB imagem) antes e depois da leitura.
2. Tipo verificado pelos **bytes** (`file-type`), não pela extensão.
3. PDF: rejeita JavaScript, ações automáticas, arquivos embutidos, XFA e criptografia.
4. Antivírus via `clamd` (INSTREAM). Em produção, sem `CLAMAV_HOST` ou com falha do scanner, o upload é **recusado** (falha fechada). Em desenvolvimento, sem scanner, o arquivo fica marcado `SKIPPED`.
5. Armazenamento privado fora de `public/` (`STORAGE_DIR`), nome aleatório, permissão 0600, proteção contra path traversal.
6. Download só por `/api/arquivos/[id]` com autorização por recurso (titular; empresa que recebeu candidatura com aquele currículo), `Content-Disposition: attachment`, `nosniff`, `CSP: sandbox`, `no-store`. Downloads de currículo por empresas são auditados.

## Auditoria e logs

`AuditLog` registra autenticação, mudanças de papel, moderação, candidaturas, privacidade e dados. Metadados passam por `redact()` (remove senhas/tokens/documentos, mascara e-mails); IPs são armazenados como HMAC com `HASH_PEPPER`. Consulta em `/admin/auditoria`.

## Segredos e dependências

- `.env` fora do Git; `ENCRYPTION_KEY` e `HASH_PEPPER` validados (32 bytes) na inicialização; produção exige `APP_URL` HTTPS e SMTP.
- `npm audit`: 0 vulnerabilidades conhecidas em 23/10/2026. A CI falha com vulnerabilidades altas.
- Recomenda-se Dependabot/Renovate e rotação periódica de `ENCRYPTION_KEY` (exige recifrar segredos MFA — procedimento a implementar).

## Moderação antifraude

Empresas só publicam após verificação manual (CNPJ com dígitos válidos é checado automaticamente; situação cadastral, domínio e site são conferidos pela moderação). Vagas com sinais de golpe ficam retidas (`PENDING_REVIEW`). Usuários podem denunciar vagas; denúncias e decisões ficam registradas.

## Não verificado nesta entrega

- Teste de intrusão independente e revisão de código por terceiros.
- Configuração de TLS, WAF, backups criptografados e monitoramento no provedor de hospedagem.
- Execução real do ClamAV (o cliente clamd foi implementado; os testes rodaram sem o contêiner antivírus).
