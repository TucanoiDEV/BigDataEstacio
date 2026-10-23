# emprego-pipeline

Ingestão de dados oficiais do mercado de trabalho para o observatório do Emprego Agora.

```bash
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"        # Linux/macOS: .venv/bin/pip
.venv/Scripts/python -m emprego_pipeline ibge
.venv/Scripts/python -m emprego_pipeline pnad
.venv/Scripts/python -m emprego_pipeline caged --de 202509 --ate 202608
.venv/Scripts/python -m emprego_pipeline status
.venv/Scripts/python -m pytest -q
```

| Módulo | Função |
|---|---|
| `download.py` | Coleta só de hosts oficiais, checksum SHA-256, FTP via curl |
| `caged.py` | Validação de layout/registros, curadoria Parquet sem atributos pessoais, reconciliação MOV/FOR/EXC, agregação |
| `ibge.py` | Territórios, CNAE, malha das UFs, PNAD (SIDRA) |
| `load.py` | Carga no PostgreSQL (COPY), registros `DataImport`/`StatDataset` em estado “em revisão” |
| `rais.py` | Estrutura para a RAIS — **não validada** com arquivo real |

Metodologia e resultados: [../docs/FONTES-DE-DADOS.md](../docs/FONTES-DE-DADOS.md). Os testes usam fixtures sintéticas no layout oficial, nunca carregadas no banco.
