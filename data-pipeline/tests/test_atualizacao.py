from datetime import date

import polars as pl

from emprego_pipeline import atualizacao as at
from emprego_pipeline.caged import RowStats
from emprego_pipeline.ibge import IndicatorRow


def test_pick_latest_competence_ignores_non_date_folders():
    years = ["2020", "2026", "Legado", "Leia-me.txt", "2025"]
    months = {"2026": ["202601", "202608", "202607", "lixo"], "2025": ["202512"]}
    assert at.pick_latest_competence(years, months) == 202608
    # Ano novo ainda sem meses publicados: usa o anterior.
    assert at.pick_latest_competence(["2026", "2027"], {"2027": [], "2026": ["202612"]}) == 202612
    assert at.pick_latest_competence(["Legado"], {}) is None


def test_window_ending_crosses_year():
    assert at.window_ending(202608) == (202509, 202608)
    assert at.window_ending(202612) == (202601, 202612)
    assert at.window_ending(202601, 3) == (202511, 202601)


def test_needs_update_only_with_newer_competence():
    assert at.needs_caged_update(202609, date(2026, 8, 1)) is True
    assert at.needs_caged_update(202608, date(2026, 8, 1)) is False
    assert at.needs_caged_update(202608, None) is True
    assert at.needs_caged_update(None, date(2026, 8, 1)) is False


def _agg(months, admissions=2_000_000, ufs=27):
    rows = []
    for c in months:
        rows.append({"competencia": c, "territory_level": "BR", "territory_code": "BR", "sector_code": "*", "occupation_code": "*", "admissions": admissions, "separations": 1_900_000, "balance": admissions - 1_900_000})
        for u in range(ufs):
            rows.append({"competencia": c, "territory_level": "UF", "territory_code": str(11 + u), "sector_code": "*", "occupation_code": "*", "admissions": 1000, "separations": 900, "balance": 100})
    return pl.DataFrame(rows)


def test_quality_gate_approves_complete_data():
    assert at.caged_quality_problems(_agg([202607, 202608]), RowStats(read=1000, valid=1000, rejected=0), 202607, 202608) == []


def test_quality_gate_blocks_missing_month_truncation_and_rejections():
    problems = at.caged_quality_problems(_agg([202608], admissions=5_000, ufs=20), RowStats(read=1000, valid=990, rejected=10), 202607, 202608)
    text = " | ".join(problems)
    assert "taxa de rejeição" in text
    assert "202607" in text  # competência ausente
    assert "truncado" in text
    assert "UFs" in text


def test_pnad_quality_gate():
    ok = [IndicatorRow("202602", "2º tri", date(2026, 4, 1), "BR", "BR", 5.8)] + [
        IndicatorRow("202602", "2º tri", date(2026, 4, 1), "UF", str(11 + i), 6.0) for i in range(27)
    ]
    assert at.pnad_quality_problems(ok, "202602") == []
    assert at.pnad_quality_problems(ok[:5], "202602")  # UFs faltando
    assert at.pnad_quality_problems([*ok, IndicatorRow("202602", "x", date(2026, 4, 1), "UF", "99", 80.0)], "202602")
