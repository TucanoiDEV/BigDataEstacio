# Como acessar e rodar o Emprego Agora

Guia prático para abrir o site no seu computador, entrar com as contas de teste e explorar cada área.

> ⚠️ **As senhas abaixo são exclusivamente para o ambiente LOCAL de desenvolvimento.** Elas existem só no banco de dados da sua máquina (acessível apenas em `localhost`). Nunca use essas contas ou senhas em um servidor público ou em produção.

---

## 1. Contas de acesso

| Perfil | E-mail | Senha | O que dá para fazer |
|---|---|---|---|
| **Administrador(a) da plataforma** | `admin@exemplo.test` | `girassol-planalto-ventania-2026` | Moderar empresas, vagas e denúncias; gerenciar usuários; ver auditoria; atender solicitações LGPD; registrar incidentes; publicar dados oficiais |
| **Candidata** | `candidata.demo@exemplo.test` | `senha-demo-local-2026` | Buscar vagas, candidatar-se, acompanhar status, salvar vagas, criar alertas, editar perfil e currículos |
| **Recrutador** (proprietário da “Empresa Demonstração”, já verificada) | `recrutador.demo@exemplo.test` | `senha-demo-local-2026` | Publicar e gerenciar vagas, mover candidaturas entre etapas, convidar membros |

- A empresa e as 6 vagas da conta de recrutador são **fictícias** (criadas pelo seed de demonstração e identificadas como tal na descrição).
- Em modo desenvolvimento o administrador **não** precisa de verificação em duas etapas. Em modo produção (`npm run build && npm start`) o admin será levado a configurar o MFA (aplicativo autenticador) antes de acessar `/admin`.
- Também é possível **criar uma conta nova** em “Criar conta”: o e-mail de confirmação chega na caixa local do Mailpit (veja a seção 3).

---

## 2. Endereços

| O quê | Endereço |
|---|---|
| Site | http://localhost:3000 |
| Entrar | http://localhost:3000/entrar |
| Painel do candidato | http://localhost:3000/minha-conta |
| Painel da empresa | menu do usuário → *Empresa Demonstração* (ou http://localhost:3000/empresa) |
| Administração | http://localhost:3000/admin |
| Observatório do mercado de trabalho | http://localhost:3000/mercado-de-trabalho |
| Caixa de e-mails local (Mailpit) | http://localhost:8025 |

---

## 3. Rodar no computador onde o projeto já foi configurado

Se o projeto já foi instalado nesta máquina (banco criado, dependências instaladas):

1. Abra o **Docker Desktop** e espere ele iniciar.
2. No terminal, na pasta do projeto:

   ```bash
   docker compose up -d postgres mailpit
   npm run dev
   ```

3. Acesse http://localhost:3000 e entre com uma das contas da seção 1.

Para parar: `Ctrl + C` no terminal do `npm run dev` e, se quiser, `docker compose stop`.

> O PostgreSQL do projeto roda na porta **5433** (não na 5432 padrão), porque esta máquina já tem um PostgreSQL próprio instalado na 5432.

---

## 4. Rodar em outro computador (instalação do zero)

### Pré-requisitos

- [Node.js](https://nodejs.org) 22 ou mais recente (testado com 24)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Git
- Python 3.11+ — **somente** se for importar os dados oficiais do observatório

### Passo a passo

```bash
# 1. Baixar o código
git clone <url-do-repositorio> emprego-agora
cd emprego-agora
git checkout feat/emprego-agora

# 2. Configuração
cp .env.example .env
```

Gere duas chaves aleatórias e cole no `.env`, em `ENCRYPTION_KEY` e `HASH_PEPPER` (uma chave diferente para cada):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```bash
# 3. Banco de dados e caixa de e-mail
docker compose up -d postgres mailpit

# 4. Dependências e tabelas
npm install
npm run db:migrate

# 5. Dados fictícios de demonstração (candidata, recrutador, empresa e vagas)
npm run db:seed:demo

# 6. Conta de administrador
#    Linux/macOS/Git Bash:
ADMIN_INITIAL_PASSWORD="girassol-planalto-ventania-2026" npm run admin:create -- --email admin@exemplo.test --name "Pessoa Gestora"
#    PowerShell:
#    $env:ADMIN_INITIAL_PASSWORD="girassol-planalto-ventania-2026"; npm run admin:create -- --email admin@exemplo.test --name "Pessoa Gestora"

# 7. Iniciar
npm run dev
```

Pronto: http://localhost:3000 com as contas da seção 1.

> **Dica:** se a porta 5433 já estiver ocupada, mude `POSTGRES_PORT` ao subir o Docker (ex.: `POSTGRES_PORT=5434 docker compose up -d postgres`) e ajuste a porta em `DATABASE_URL` e `TEST_DATABASE_URL` no `.env`.

### Dados do observatório (opcional)

Sem este passo o site funciona normalmente, mas a página “Mercado de trabalho” mostra um aviso de que ainda não há dados oficiais publicados. Para importar os dados reais do Novo CAGED e do IBGE (download de ~650 MB):

```bash
cd data-pipeline
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"          # Linux/macOS: .venv/bin/pip install -e ".[dev]"
.venv/Scripts/python -m emprego_pipeline ibge
.venv/Scripts/python -m emprego_pipeline atualizar --publicar
cd ..
```

O comando `atualizar --publicar` busca os 12 meses mais recentes e já publica no observatório se os dados passarem nas verificações de qualidade (leva alguns minutos). Para conferir ou publicar manualmente: entre como admin → **Administração → Dados oficiais**.

### Atualizações automáticas (opcional, Windows)

Para o computador manter alertas de vagas e dados oficiais atualizados sozinho:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\agendamento\registrar-tarefas.ps1
```

Detalhes em [docs/DEPLOY.md](docs/DEPLOY.md#tarefas-agendadas).

---

## 5. Roteiro sugerido para conhecer o site

1. **Visitante** — abra a página inicial, escolha uma opção no aviso de cookies, use a busca e abra uma vaga.
2. **Candidata** — entre como `candidata.demo@exemplo.test`, veja as recomendações no painel, candidate-se a uma vaga e acompanhe em *Candidaturas*.
3. **Recrutador** — em outra janela anônima, entre como `recrutador.demo@exemplo.test`, abra *Empresa Demonstração → Vagas e candidaturas*, abra a candidatura e mova para “Em análise” com uma mensagem.
4. **Candidata** — atualize a página da candidatura: o novo status e a mensagem aparecem (e a notificação no sino).
5. **Administrador** — entre como `admin@exemplo.test` e explore **/admin**: filas de moderação, auditoria (todas as ações acima ficam registradas) e dados oficiais.
6. **Observatório** — abra *Mercado de trabalho*, escolha uma UF no mapa ou no filtro e alterne “Gráfico/Tabela”.

---

## 6. Problemas comuns

| Sintoma | Solução |
|---|---|
| `Can't reach database server` / erro de conexão | O Docker Desktop está aberto? Rode `docker compose up -d postgres` |
| Login diz “E-mail ou senha incorretos” com a senha certa | Após 10 tentativas erradas a conta fica bloqueada por 15 minutos. Aguarde ou use “Esqueci a senha” (o link chega no Mailpit) |
| Não chegou o e-mail de confirmação/recuperação | Os e-mails locais ficam em http://localhost:8025 |
| Página “Mercado de trabalho” sem dados | Importe e publique os dados (seção 4, *Dados do observatório*) |
| `ENCRYPTION_KEY: deve ter 32 bytes em base64` | Gere as chaves com o comando da seção 4 e cole sem aspas no `.env` |
| Quero recomeçar do zero | `docker compose down -v` (apaga o banco local) e refaça os passos 3 a 6 |

---

## 7. Testes (opcional)

```bash
npm run test:unit          # testes de unidade
npm run test:integration   # integração (usa o banco de teste emprego_agora_test)
npm run test:e2e           # navegador automatizado (instale antes: npx playwright install chromium)
```

Documentação técnica completa: [README.md](README.md) e pasta [docs/](docs/).
