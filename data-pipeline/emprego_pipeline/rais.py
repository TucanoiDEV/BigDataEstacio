"""RAIS — estoque de vínculos formais em 31/12 (ESTRUTURA PREPARADA, NÃO VALIDADA).

Status: este módulo define a normalização e a agregação, mas AINDA NÃO foi
executado contra um arquivo real da RAIS nesta entrega. Os microdados de vínculos
(RAIS_VINC_PUB_*) têm vários GB por região; a carga completa é o caso de uso
previsto para PySpark (ver docs/FONTES-DE-DADOS.md). Antes de usar:
  1. Baixe um arquivo de ftp://ftp.mtps.gov.br/pdet/microdados/RAIS/<ano>/
  2. Confirme os nomes de coluna do layout do ano em COLUMN_MAP
  3. Rode os testes com uma amostra real e valide os totais contra os
     resultados oficiais divulgados pelo MTE para o mesmo ano.
"""

from __future__ import annotations

import polars as pl

# Nomes (normalizados) esperados no layout de vínculos. CONFERIR por ano.
COLUMN_MAP = {
    "ativo_3112": "vinculoativo31/12",
    "municipio": "municipio",
    "cnae_classe": "cnae2.0classe",
    "cbo": "cboocupacao2002",
    "remuneracao_dez": "vlremundezembronom",
}

# Divisões CNAE 2.0 (2 primeiros dígitos da classe) -> seção (A–U).
DIVISION_TO_SECTION = {
    **{d: "A" for d in range(1, 4)},
    **{d: "B" for d in range(5, 10)},
    **{d: "C" for d in range(10, 34)},
    35: "D",
    **{d: "E" for d in range(36, 40)},
    **{d: "F" for d in range(41, 44)},
    **{d: "G" for d in range(45, 48)},
    **{d: "H" for d in range(49, 54)},
    **{d: "I" for d in range(55, 57)},
    **{d: "J" for d in range(58, 64)},
    **{d: "K" for d in range(64, 67)},
    68: "L",
    **{d: "M" for d in range(69, 76)},
    **{d: "N" for d in range(77, 83)},
    84: "O",
    85: "P",
    **{d: "Q" for d in range(86, 89)},
    **{d: "R" for d in range(90, 94)},
    **{d: "S" for d in range(94, 97)},
    97: "T",
    99: "U",
}


def section_from_class(cnae_class: str) -> str | None:
    digits = "".join(ch for ch in cnae_class if ch.isdigit())
    if len(digits) < 2:
        return None
    return DIVISION_TO_SECTION.get(int(digits[:2]))


def aggregate_stock(lf: pl.LazyFrame) -> pl.LazyFrame:
    """Vínculos ativos em 31/12 por município e seção CNAE (entrada já normalizada)."""
    return (
        lf.filter(pl.col("ativo_3112") == "1")
        .with_columns(pl.col("cnae_classe").map_elements(section_from_class, return_dtype=pl.Utf8).alias("secao"))
        .group_by(["municipio", "secao"])
        .agg(pl.len().alias("active_links"))
    )
