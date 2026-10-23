# Fontes de dados e pipeline

## Fontes

| Fonte | Conteúdo usado | Acesso | Status |
|---|---|---|---|
| **Novo CAGED** (MTE/PDET) | Microdados mensais `CAGEDMOV`, `CAGEDFOR`, `CAGEDEXC` | `ftp://ftp.mtps.gov.br/pdet/microdados/NOVO CAGED/<ano>/<AAAAMM>/` | **Importado e validado**: 09/2025–08/2026 |
| **IBGE — Localidades** | UFs e municípios (código de 7 dígitos) | `servicodados.ibge.gov.br/api/v1/localidades` | Importado (27 UFs, 5.571 municípios) |
| **IBGE — CNAE 2.0** | Seções A–U | `servicodados.ibge.gov.br/api/v2/cnae/secoes` | Importado |
| **IBGE — Malhas** | Contorno das UFs (qualidade mínima, só visualização) | `servicodados.ibge.gov.br/api/v3/malhas` | Importado em `public/geo/br-uf.json` |
| **IBGE — PNAD Contínua** | Taxa de desocupação trimestral, Brasil e UFs (SIDRA 4099, últimos 12 trimestres) | `apisidra.ibge.gov.br` | Importado |
| **CBO 2002** (MTE) | Títulos dos 10 grandes grupos | Lista fixa no código (`ibge.py`) | Carregado |
| **RAIS** (MTE) | Estoque de vínculos em 31/12 | `ftp://ftp.mtps.gov.br/pdet/microdados/RAIS/` | **Pendente**: estrutura em `rais.py`, não validada com arquivo real; não exibida |

Apenas esses domínios podem ser baixados (`ALLOWED_HOSTS` em `config.py`).

## Execução

```bash
cd data-pipeline
python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"
.venv/Scripts/python -m emprego_pipeline ibge          # 1º: territórios são pré-requisito do CAGED
.venv/Scripts/python -m emprego_pipeline pnad
.venv/Scripts/python -m emprego_pipeline caged --de 202509 --ate 202608
.venv/Scripts/python -m emprego_pipeline status
.venv/Scripts/python -m pytest -q
```

Usa `DATABASE_URL` do `.env` da raiz (ou `PIPELINE_DATABASE_URL`). Downloads FTP usam `curl` quando disponível (o `ftplib` trava com o modo EPSV do servidor do MTE).

Depois de importar, publique em **/admin/dados**: um único conjunto por fonte fica publicado; o anterior é arquivado.

## Camadas

```
data/raw/         arquivos originais (.7z/.json) — SHA-256 registrado em DataImport.files
data/curated/     Parquet por arquivo de origem, apenas colunas não sensíveis
data/aggregates/  Parquet com os agregados carregados no banco
```

## Novo CAGED — metodologia aplicada

- **Reconciliação**: cada competência = MOV da competência + FOR de meses posteriores com aquela `competênciamov` − EXC de meses posteriores. Competências recentes podem mudar quando novos meses são importados (refaça a importação do período).
- **Validação por arquivo**: colunas exigidas no cabeçalho (layout), e por registro: competência, `saldomovimentação ∈ {1,−1}`, UF/município numéricos, seção CNAE. Rejeição > 1% aborta a carga.
- **Codificação**: os arquivos oficiais variam entre UTF-8 e Latin-1 conforme o mês; o cabeçalho é decodificado com fallback (testado).
- **Território**: município CAGED (6 dígitos) → IBGE (7 dígitos). Registros sem UF/município identificáveis entram só no total Brasil.
- **Agregações**: Brasil e UF (total, por seção CNAE, por grande grupo CBO); município (total).
- **Salário**: mediana do salário de admissão — mensalistas (`unidadesaláriocódigo = 5`), não intermitentes, entre 0,3 e 150 salários mínimos do ano, publicada só com ≥ 30 admissões válidas. A mediana foi escolhida porque os microdados contêm valores extremos (ex.: R$ 500.000 em declarações fora do prazo). **Difere da média divulgada pelo MTE.**
- **Consistência**: verificação de que a soma das UFs não excede o total Brasil; `CHECK balance = admissions − separations` no banco.

### Resultado da importação real (23/10/2026)

- 36 arquivos oficiais (12 competências × MOV/FOR/EXC), 52.637.524 registros no período, 0 rejeitados, 75.999 agregados.
- Brasil, saldo mensal: de +214.688 (09/2025) a +165.827 (08/2026), com −635.078 em 12/2025 (sazonalidade de dezembro). Acumulado de 12 meses: +887.708.
- Esses valores foram conferidos quanto à plausibilidade, **não** reconciliados número a número com as publicações oficiais do MTE; diferenças pequenas são esperadas por data de extração. Para uso oficial, consulte a fonte.

## Expansão para Big Data (planejada)

1. **Histórico completo** do Novo CAGED (2020+) e **RAIS** (vários GB por ano): executar `curate_file` e `aggregate` como jobs **PySpark** lendo a mesma camada Parquet em armazenamento de objetos (S3/MinIO), particionada por `competencia`.
2. Orquestração (Airflow/Dagster) com agendamento mensal após a divulgação do MTE e alertas de falha.
3. Testes de reconciliação automáticos contra os totais publicados pelo MTE.
