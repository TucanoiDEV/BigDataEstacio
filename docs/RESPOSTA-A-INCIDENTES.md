# Procedimento de resposta a incidentes de segurança

> Minuta operacional. Confirme prazos e conteúdo das comunicações com a assessoria jurídica e com a regulamentação vigente da ANPD (Resolução CD/ANPD nº 15/2024 à época desta redação).

## 1. Detecção e registro (imediato)

- Qualquer pessoa da equipe que suspeitar de incidente avisa o responsável de segurança e o encarregado (DPO).
- Registrar em **/admin/incidentes**: título, descrição, data/hora da detecção, severidade inicial.

## 2. Contenção (primeiras horas)

Medidas disponíveis na aplicação:

| Situação | Ação |
|---|---|
| Conta comprometida | `/admin/usuarios` → suspender e encerrar sessões |
| Empresa fraudulenta | `/admin/empresas` → suspender (vagas ativas são pausadas e saem da busca) |
| Vaga maliciosa | `/admin/vagas` → remover |
| Vazamento de segredo | Rotacionar `HASH_PEPPER`/credenciais; para `ENCRYPTION_KEY`, desativar e reconfigurar MFA dos usuários |
| Sessões em massa | `DELETE FROM "Session";` (todos precisarão entrar novamente) |

Preserve evidências: exporte trechos de `AuditLog` e logs do servidor antes de qualquer limpeza.

## 3. Avaliação de risco

Registre no incidente: dados pessoais afetados (sim/não), categorias (e-mail, currículo, telefone…), estimativa de titulares, probabilidade e gravidade do dano. Incidentes que possam acarretar **risco ou dano relevante** aos titulares exigem comunicação.

## 4. Comunicação

- **ANPD**: pelo canal oficial, no prazo regulamentar (3 dias úteis pela Resolução nº 15/2024), com: descrição, dados e titulares afetados, medidas técnicas de segurança, riscos, medidas adotadas e contato do encarregado. Registre a data em “ANPD comunicada em”.
- **Titulares**: linguagem clara, o que aconteceu, dados envolvidos, riscos, o que fazer (ex.: trocar senha, ativar MFA) e contato. Registre “Titulares comunicados em”.
- **Empresas recrutadoras**, quando os dados que elas receberam estiverem envolvidos.

## 5. Erradicação, recuperação e lições aprendidas

- Corrigir a causa, restaurar a partir de backup se necessário (ver [DEPLOY.md](DEPLOY.md)), acompanhar indicadores.
- Marcar o incidente como **Resolvido** com as medidas adotadas e abrir tarefas preventivas.
- Guardar o registro pelo prazo definido na política de retenção.
