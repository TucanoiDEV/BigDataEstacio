"""Atualização automática (agendada): detecta dados novos nas fontes oficiais,
importa e publica somente se os portões de qualidade forem aprovados."""

from __future__ import annotations

import ftplib
import re
import shutil
import subprocess
from datetime import date
from urllib.parse import unquote, urlparse

import polars as pl

from .caged import RowStats, month_range
from .config import CAGED_FTP_BASE
from .download import assert_allowed

# Portões de qualidade para publicação automática (mais rígidos que os de importação).
AUTO_PUBLISH_MAX_REJECTED_RATIO = 0.001
# Sanidade: o Brasil registra bem mais de 1 milhão de admissões por mês; um total
# muito abaixo indica arquivo truncado ou corrompido.
MIN_MONTHLY_BR_ADMISSIONS = 300_000
WINDOW_MONTHS = 12


def list_ftp(url: str) -> list[str]:
    """Lista nomes em um diretório FTP oficial (curl; ftplib como alternativa)."""
    assert_allowed(url)
    url = url.rstrip("/") + "/"
    curl = shutil.which("curl")
    if curl:
        res = subprocess.run([curl, "--silent", "--show-error", "--fail", "--list-only", "--connect-timeout", "30", "--max-time", "120", url],
                             capture_output=True, text=True, encoding="latin-1", timeout=180)
        if res.returncode != 0:
            raise IOError(f"Falha ao listar {url}: {res.stderr.strip()[:200]}")
        return [line.strip() for line in res.stdout.splitlines() if line.strip()]
    parsed = urlparse(url)
    with ftplib.FTP(parsed.hostname, timeout=60) as ftp:
        ftp.login()
        return [n.rsplit("/", 1)[-1] for n in ftp.nlst(unquote(parsed.path))]


def pick_latest_competence(years: list[str], months_by_year: dict[str, list[str]]) -> int | None:
    """Maior competência AAAAMM disponível, ignorando pastas que não são datas."""
    for year in sorted((y for y in years if re.fullmatch(r"20\d{2}", y)), reverse=True):
        months = [int(m) for m in months_by_year.get(year, []) if re.fullmatch(rf"{year}(0[1-9]|1[0-2])", m)]
        if months:
            return max(months)
    return None


def latest_caged_competence() -> int | None:
    years = list_ftp(CAGED_FTP_BASE)
    candidates = sorted((y for y in years if re.fullmatch(r"20\d{2}", y)), reverse=True)[:2]
    months_by_year = {}
    for y in candidates:
        names = list_ftp(f"{CAGED_FTP_BASE}/{y}")
        months_by_year[y] = names
    latest = pick_latest_competence(candidates, months_by_year)
    if latest is None:
        return None
    # Só considera a competência disponível se o arquivo de movimentações já foi publicado.
    files = list_ftp(f"{CAGED_FTP_BASE}/{latest // 100}/{latest}")
    return latest if f"CAGEDMOV{latest}.7z" in files else None


def window_ending(comp: int, months: int = WINDOW_MONTHS) -> tuple[int, int]:
    """Janela de `months` competências terminando em `comp` (inclusive)."""
    y, m = comp // 100, comp % 100
    total = y * 12 + (m - 1) - (months - 1)
    start = (total // 12) * 100 + (total % 12) + 1
    return start, comp


def to_competence(d: date) -> int:
    return d.year * 100 + d.month


def needs_caged_update(latest_available: int | None, latest_imported: date | None) -> bool:
    if latest_available is None:
        return False
    return latest_imported is None or latest_available > to_competence(latest_imported)


def caged_quality_problems(agg: pl.DataFrame, stats: RowStats, comp_from: int, comp_to: int) -> list[str]:
    """Lista de motivos que IMPEDEM a publicação automática (vazia = aprovado)."""
    problems: list[str] = []
    if stats.read == 0:
        return ["nenhuma linha lida"]
    ratio = stats.rejected / stats.read
    if ratio > AUTO_PUBLISH_MAX_REJECTED_RATIO:
        problems.append(f"taxa de rejeição {ratio:.3%} acima de {AUTO_PUBLISH_MAX_REJECTED_RATIO:.1%}")
    br = agg.filter((pl.col("territory_level") == "BR") & (pl.col("sector_code") == "*") & (pl.col("occupation_code") == "*"))
    present = set(br["competencia"].to_list())
    missing = [c for c in month_range(comp_from, comp_to) if c not in present]
    if missing:
        problems.append(f"competências sem total Brasil: {missing}")
    low = br.filter(pl.col("admissions") < MIN_MONTHLY_BR_ADMISSIONS)["competencia"].to_list()
    if low:
        problems.append(f"admissões no Brasil abaixo de {MIN_MONTHLY_BR_ADMISSIONS:,} em {low} (possível arquivo truncado)")
    if br.filter(pl.col("balance") != pl.col("admissions") - pl.col("separations")).height:
        problems.append("saldo inconsistente com admissões − desligamentos")
    ufs = agg.filter((pl.col("territory_level") == "UF") & (pl.col("sector_code") == "*") & (pl.col("occupation_code") == "*"))
    last_ufs = ufs.filter(pl.col("competencia") == comp_to)["territory_code"].n_unique()
    if last_ufs < 27:
        problems.append(f"apenas {last_ufs} UFs na última competência")
    return problems


def pnad_quality_problems(rows: list, latest_period: str) -> list[str]:
    latest = [r for r in rows if r.period_code == latest_period]
    problems = []
    if not any(r.territory_level == "BR" for r in latest):
        problems.append("sem valor para o Brasil no trimestre mais recente")
    if sum(1 for r in latest if r.territory_level == "UF") < 27:
        problems.append("menos de 27 UFs no trimestre mais recente")
    if any(not 0 < r.value < 50 for r in rows):
        problems.append("taxa fora do intervalo plausível (0–50%)")
    return problems
