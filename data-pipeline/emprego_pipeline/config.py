"""Configuração: diretórios, conexão e parâmetros metodológicos."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = ROOT.parent

# Camadas do "data lake" local. Em produção, os mesmos caminhos podem apontar
# para armazenamento de objetos (S3/MinIO) lido por PySpark.
DATA_DIR = Path(os.environ.get("PIPELINE_DATA_DIR", ROOT / "data"))
RAW_DIR = DATA_DIR / "raw"  # arquivos originais, intocados (com SHA-256 registrado)
CURATED_DIR = DATA_DIR / "curated"  # Parquet normalizado, sem atributos pessoais sensíveis
AGG_DIR = DATA_DIR / "aggregates"  # Parquet agregado, pronto para carga

# Somente fontes oficiais autorizadas são baixadas.
ALLOWED_HOSTS = {
    "ftp.mtps.gov.br",  # PDET / Ministério do Trabalho e Emprego
    "servicodados.ibge.gov.br",  # APIs de serviço do IBGE
    "apisidra.ibge.gov.br",  # SIDRA / IBGE
}

CAGED_FTP_BASE = "ftp://ftp.mtps.gov.br/pdet/microdados/NOVO%20CAGED"

# Salário mínimo nacional por ano (R$/mês) — usado no filtro de valores salariais
# válidos (0,3 a 150 SM, critério alinhado às notas técnicas do Novo CAGED).
# Em 2023 o valor mudou em maio (R$ 1.302 -> R$ 1.320); usamos o valor de maio em diante.
MINIMUM_WAGE = {
    2020: 1045.00,
    2021: 1100.00,
    2022: 1212.00,
    2023: 1320.00,
    2024: 1412.00,
    2025: 1518.00,
    2026: 1621.00,
}

# Mediana salarial só é publicada com amostra mínima (evita estimativas instáveis
# e reduz risco de reidentificação em recortes pequenos).
MIN_WAGE_SAMPLE = 30

# Proporção máxima de linhas rejeitadas antes de abortar a importação.
MAX_REJECTED_RATIO = 0.01


def _load_dotenv() -> None:
    env_file = REPO_ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        m = re.match(r'^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$', line)
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2)


@dataclass(frozen=True)
class DbConfig:
    dsn: str


def db_config() -> DbConfig:
    _load_dotenv()
    url = os.environ.get("PIPELINE_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("Defina DATABASE_URL (ou PIPELINE_DATABASE_URL).")
    # psycopg não aceita o parâmetro ?schema= usado pelo Prisma.
    url = re.sub(r"([?&])schema=[^&]*&?", r"\1", url).rstrip("?&")
    return DbConfig(dsn=url)
