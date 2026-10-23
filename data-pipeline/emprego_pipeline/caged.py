"""Novo CAGED: leitura, validação, normalização e agregação dos microdados.

Metodologia de reconciliação (dados "com ajustes"):
  - CAGEDMOV<AAAAMM>: movimentações declaradas no prazo da competência AAAAMM.
  - CAGEDFOR<AAAAMM>: declarações fora do prazo recebidas em AAAAMM, de competências
    ANTERIORES (coluna competênciamov). Somam à competência original.
  - CAGEDEXC<AAAAMM>: exclusões recebidas em AAAAMM de movimentações já declaradas.
    Subtraem da competência original.
A série de uma competência fica completa à medida que meses posteriores são importados.

Minimização de dados: atributos pessoais presentes nos microdados (sexo, raça/cor,
idade, grau de instrução, deficiência) NÃO são lidos. Apenas território, atividade
econômica (seção CNAE), ocupação (grande grupo CBO) e salário de admissão entram
no pipeline.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from pathlib import Path

import polars as pl
import py7zr

from .config import CAGED_FTP_BASE, CURATED_DIR, MIN_WAGE_SAMPLE, MINIMUM_WAGE, RAW_DIR
from .download import FetchedFile, fetch

KINDS = ("MOV", "FOR", "EXC")

# Colunas utilizadas (nomes normalizados: sem acentos, minúsculos).
USED_COLUMNS = [
    "competenciamov",
    "uf",
    "municipio",
    "secao",
    "saldomovimentacao",
    "cbo2002ocupacao",
    "salario",
    "indtrabintermitente",
    "unidadesalariocodigo",
]

# Colunas que precisam existir no cabeçalho oficial (validação de layout).
REQUIRED_HEADER = set(USED_COLUMNS) | {"regiao", "subclasse", "tipomovimentacao", "competenciadec"}

# Atributos pessoais explicitamente descartados (documentação/auditoria).
DISCARDED_SENSITIVE = ["idade", "racacor", "sexo", "graudeinstrucao", "tipodedeficiencia"]

VALID_UF_CODES = {
    "11", "12", "13", "14", "15", "16", "17", "21", "22", "23", "24", "25", "26", "27", "28", "29",
    "31", "32", "33", "35", "41", "42", "43", "50", "51", "52", "53",
}
UNKNOWN = "IGNORADO"


def normalize_header(name: str) -> str:
    n = unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode("ascii")
    return n.strip().lower().replace(" ", "")


def month_range(start: int, end: int) -> list[int]:
    """[202501, 202502, ...] inclusivo."""
    if start > end:
        raise ValueError("Competência inicial maior que a final")
    out, y, m = [], start // 100, start % 100
    while y * 100 + m <= end:
        out.append(y * 100 + m)
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def remote_url(kind: str, comp: int) -> str:
    return f"{CAGED_FTP_BASE}/{comp // 100}/{comp}/CAGED{kind}{comp}.7z"


def fetch_month(comp: int) -> list[FetchedFile]:
    files = []
    for kind in KINDS:
        dest = RAW_DIR / "novo_caged" / str(comp) / f"CAGED{kind}{comp}.7z"
        files.append(fetch(remote_url(kind, comp), dest))
    return files


def extract(archive: Path) -> Path:
    """Extrai o .txt do .7z (uma vez) e retorna o caminho."""
    txt = archive.with_suffix(".txt")
    if not txt.exists():
        with py7zr.SevenZipFile(archive) as z:
            names = z.getnames()
            if len(names) != 1 or not names[0].lower().endswith(".txt"):
                raise ValueError(f"Conteúdo inesperado em {archive.name}: {names}")
            z.extractall(path=archive.parent)
    return txt


def read_header(txt: Path) -> list[str]:
    with txt.open("rb") as f:
        line = f.readline()
    # A codificação dos arquivos oficiais varia entre competências (UTF-8 ou Latin-1).
    try:
        text = line.decode("utf-8")
    except UnicodeDecodeError:
        text = line.decode("latin-1")
    return [normalize_header(c) for c in text.lstrip("﻿").rstrip("\r\n").split(";")]


@dataclass
class RowStats:
    read: int = 0
    valid: int = 0
    rejected: int = 0


def scan_file(txt: Path, kind: str) -> pl.LazyFrame:
    """LazyFrame normalizado de um arquivo CAGED{kind}. Lê apenas as colunas necessárias."""
    header = read_header(txt)
    missing = REQUIRED_HEADER - set(header)
    if missing:
        raise ValueError(f"Layout inesperado em {txt.name}: colunas ausentes {sorted(missing)}")

    lf = pl.scan_csv(
        txt,
        separator=";",
        has_header=True,
        new_columns=header,
        encoding="utf8-lossy",
        infer_schema=False,  # tudo como texto; conversões explícitas abaixo
        quote_char=None,
    ).select(USED_COLUMNS)

    sign = -1 if kind == "EXC" else 1
    return lf.with_columns(
        pl.col("competenciamov").cast(pl.Int32, strict=False).alias("competencia"),
        pl.col("uf").str.strip_chars().alias("uf"),
        pl.col("municipio").str.strip_chars().alias("mun6"),
        pl.col("secao").str.strip_chars().str.to_uppercase().alias("secao"),
        pl.col("saldomovimentacao").cast(pl.Int8, strict=False).alias("saldo"),
        pl.col("cbo2002ocupacao").str.strip_chars().str.slice(0, 1).alias("cbo_gg"),
        pl.col("salario").str.replace_all(r"\.", "").str.replace(",", ".").cast(pl.Float64, strict=False).alias("salario"),
        (pl.col("indtrabintermitente").str.strip_chars() == "1").alias("intermitente"),
        pl.col("unidadesalariocodigo").str.strip_chars().alias("unidade_salario"),
        pl.lit(sign, dtype=pl.Int8).alias("sign"),
        pl.lit(kind).alias("origem"),
    ).select(["competencia", "uf", "mun6", "secao", "saldo", "cbo_gg", "salario", "intermitente", "unidade_salario", "sign", "origem"])


def validity_expr() -> pl.Expr:
    return (
        pl.col("competencia").is_not_null()
        & pl.col("saldo").is_in([1, -1])
        & pl.col("uf").str.contains(r"^\d{2}$")
        & pl.col("mun6").str.contains(r"^\d{6}$")
        & pl.col("secao").str.contains(r"^[A-Z]$")
    )


def wage_valid_expr() -> pl.Expr:
    """Salário de admissão válido: mensal (código 5), não intermitente, entre 0,3 e 150 SM."""
    sm = pl.col("competencia").floordiv(100).replace_strict(MINIMUM_WAGE, default=None, return_dtype=pl.Float64)
    return (
        (pl.col("saldo") == 1)
        & (pl.col("sign") == 1)
        & ~pl.col("intermitente")
        & (pl.col("unidade_salario") == "5")
        & pl.col("salario").is_not_null()
        & (pl.col("salario") >= sm * 0.3)
        & (pl.col("salario") <= sm * 150)
    )


CURATED_COLUMNS = ["competencia", "uf", "mun7", "secao", "cbo_gg", "saldo", "sign", "salario", "salario_valido", "origem", "valido"]


def normalize(lf: pl.LazyFrame, mun_map: dict[str, str]) -> pl.LazyFrame:
    """Valida, mapeia município (6 -> 7 dígitos IBGE) e marca salário válido."""
    map_df = pl.LazyFrame({"mun6": list(mun_map.keys()), "mun7": list(mun_map.values())})
    return (
        lf.with_columns(validity_expr().fill_null(False).alias("valido"))
        .join(map_df, on="mun6", how="left")
        .with_columns(
            pl.when(pl.col("uf").is_in(list(VALID_UF_CODES))).then(pl.col("uf")).otherwise(pl.lit(UNKNOWN)).alias("uf"),
            pl.col("mun7").fill_null(pl.lit(UNKNOWN)),
            pl.when(pl.col("cbo_gg").str.contains(r"^\d$")).then(pl.col("cbo_gg")).otherwise(pl.lit(UNKNOWN)).alias("cbo_gg"),
            wage_valid_expr().fill_null(False).alias("salario_valido"),
        )
        .select(CURATED_COLUMNS)
    )


def curate_file(archive: Path, mun_map: dict[str, str], *, keep_txt: bool = False) -> Path:
    """Extrai um arquivo oficial, normaliza e grava a partição curada em Parquet.

    A camada curada contém SOMENTE colunas não sensíveis e é a base para
    processamento distribuído futuro (PySpark lê os mesmos arquivos Parquet).
    """
    kind = next(k for k in KINDS if f"CAGED{k}" in archive.name)
    out = CURATED_DIR / "novo_caged" / f"{archive.stem}.parquet"
    if out.exists():
        return out
    txt = extract(archive)
    out.parent.mkdir(parents=True, exist_ok=True)
    normalize(scan_file(txt, kind), mun_map).sink_parquet(out)
    if not keep_txt:
        txt.unlink(missing_ok=True)
    return out


def load_curated(paths: list[Path], comp_from: int, comp_to: int) -> tuple[pl.LazyFrame, RowStats]:
    """Lê as partições curadas, restringe ao período e devolve os válidos + estatísticas."""
    lf = pl.scan_parquet(paths).filter(pl.col("competencia").is_between(comp_from, comp_to))
    counts = lf.group_by("valido").agg(pl.len().alias("n")).collect()
    by = {row["valido"]: row["n"] for row in counts.iter_rows(named=True)}
    stats = RowStats(read=sum(by.values()), valid=by.get(True, 0), rejected=by.get(False, 0))
    return lf.filter(pl.col("valido")), stats


def _agg(lf: pl.LazyFrame, level: str, code_col: str | None, sector: bool, occupation: bool) -> pl.LazyFrame:
    keys = ["competencia"]
    if code_col:
        keys.append(code_col)
    if sector:
        keys.append("secao")
    if occupation:
        keys.append("cbo_gg")
    grouped = lf.group_by(keys).agg(
        pl.when(pl.col("saldo") == 1).then(pl.col("sign")).otherwise(0).sum().cast(pl.Int64).alias("admissions"),
        pl.when(pl.col("saldo") == -1).then(pl.col("sign")).otherwise(0).sum().cast(pl.Int64).alias("separations"),
        pl.col("salario").filter(pl.col("salario_valido")).median().alias("wage_median"),
        pl.col("salario_valido").sum().cast(pl.Int64).alias("wage_n"),
    )
    return grouped.with_columns(
        pl.lit(level).alias("territory_level"),
        (pl.col(code_col) if code_col else pl.lit("BR")).alias("territory_code"),
        (pl.col("secao") if sector else pl.lit("*")).alias("sector_code"),
        (pl.col("cbo_gg") if occupation else pl.lit("*")).alias("occupation_code"),
    ).select(["competencia", "territory_level", "territory_code", "sector_code", "occupation_code", "admissions", "separations", "wage_median", "wage_n"])


def aggregate(valid: pl.LazyFrame) -> pl.DataFrame:
    """Agregados por Brasil/UF (total, por seção CNAE, por grande grupo CBO) e município (total)."""
    parts = [
        _agg(valid, "BR", None, False, False),
        _agg(valid, "BR", None, True, False),
        _agg(valid, "BR", None, False, True),
        _agg(valid, "UF", "uf", False, False),
        _agg(valid, "UF", "uf", True, False),
        _agg(valid, "UF", "uf", False, True),
        _agg(valid, "MUNICIPALITY", "mun7", False, False),
    ]
    df = pl.concat([p.collect(engine="streaming") for p in parts], how="vertical")
    # Exclusões podem tornar contagens negativas em recortes ínfimos de dados ainda
    # incompletos; nesses casos o registro é descartado em vez de publicar valor inválido.
    df = df.filter((pl.col("admissions") >= 0) & (pl.col("separations") >= 0))
    df = df.filter(~pl.col("territory_code").eq(UNKNOWN))
    return df.with_columns(
        (pl.col("admissions") - pl.col("separations")).alias("balance"),
        pl.when(pl.col("wage_n") >= MIN_WAGE_SAMPLE).then(pl.col("wage_median").round(2)).otherwise(None).alias("wage_median"),
        pl.when(pl.col("wage_n") >= MIN_WAGE_SAMPLE).then(pl.col("wage_n")).otherwise(None).alias("wage_n"),
    )
