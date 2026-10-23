# Deploy e operação

## Requisitos de produção

- PostgreSQL 15+ gerenciado, com TLS, backups automáticos e criptografia em repouso.
- Volume persistente e privado para `STORAGE_DIR` (ou adaptar `src/server/storage/files.ts` para armazenamento de objetos com URLs assinadas — recomendado para várias instâncias).
- ClamAV (`clamd`) acessível em `CLAMAV_HOST:CLAMAV_PORT` — **sem ele, uploads são recusados em produção**.
- SMTP transacional (`SMTP_*`, `MAIL_FROM`) com SPF/DKIM/DMARC configurados no domínio.
- HTTPS no proxy reverso/CDN; `APP_URL=https://...` **no build e no runtime**; `TRUST_PROXY=true` apenas se o proxy sobrescreve `X-Forwarded-For`.

## Variáveis

Veja `.env.example` (sem aspas — compatível com `docker --env-file`). Obrigatórias em produção: `APP_URL` (https), `DATABASE_URL`, `ENCRYPTION_KEY`, `HASH_PEPPER`, `SMTP_HOST`. Variáveis `NEXT_PUBLIC_*` são embutidas no **build**.

## Docker

```bash
docker build --build-arg APP_URL=https://empregoagora.example -t emprego-agora .
docker run --rm --env-file .env.production emprego-agora npx prisma migrate deploy
docker run -d --env-file .env.production -p 3000:3000 -v ea-storage:/data/storage emprego-agora
```

A imagem roda como usuário sem privilégios, expõe `HEALTHCHECK` em `/api/health` e foi testada localmente (build, migração, páginas públicas e observatório). Otimização futura: `output: "standalone"` para reduzir o tamanho (hoje ~1,9 GB).

Para testar a imagem com o Compose local: `docker compose --profile app up --build`.

## Ordem de deploy

1. Backup do banco.
2. `prisma migrate deploy` (migrações são aditivas; revise migrações destrutivas antes).
3. Subir a nova versão; verificar `/api/health`.
4. Criar o primeiro administrador com `npm run admin:create` (dentro do contêiner) e configurar o MFA no primeiro acesso.

## Tarefas agendadas (cron)

| Tarefa | Frequência sugerida | Comando |
|---|---|---|
| Alertas de vagas | A cada hora | `npm run jobs:alerts` |
| Limpeza de sessões/tokens/limites | Diária | `npm run jobs:maintenance` |
| Importação Novo CAGED | Mensal, após a divulgação do MTE | `python -m emprego_pipeline caged --de <AAAAMM> --ate <AAAAMM>` + publicação no admin |
| PNAD Contínua | Trimestral | `python -m emprego_pipeline pnad` |

## Backup e restauração

```bash
# Backup lógico (agende diariamente; guarde cifrado e fora do servidor)
pg_dump --format=custom --no-owner "$DATABASE_URL" > emprego-$(date +%F).dump
# Arquivos privados
tar czf storage-$(date +%F).tgz -C /data storage

# Restauração (em banco vazio)
pg_restore --no-owner --dbname "$DATABASE_URL" emprego-AAAA-MM-DD.dump
tar xzf storage-AAAA-MM-DD.tgz -C /data
```

Teste a restauração periodicamente em ambiente isolado. Exclusões de conta já executadas não devem “ressuscitar” após restauração: mantenha a retenção de backups curta e documentada.

## Monitoramento

- Saúde: `/api/health` (verifica o banco).
- Erros: os logs do servidor registram exceções com `digest` (mostrado ao usuário na página de erro) — integre a um coletor (ex.: OpenTelemetry/Sentry autogerenciado).
- Segurança: acompanhe `/admin/auditoria` (falhas de login, bloqueios, `file.malware_blocked`, mudanças de papel).
- Dependências: `npm audit` na CI e atualização periódica.
