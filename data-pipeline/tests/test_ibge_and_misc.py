from datetime import date

import pytest

from emprego_pipeline import ibge, rais
from emprego_pipeline.download import assert_allowed
from emprego_pipeline.config import db_config


def test_quarter_start():
    assert ibge.quarter_start("202503") == date(2025, 7, 1)
    assert ibge.quarter_start("202601") == date(2026, 1, 1)
    with pytest.raises(ValueError):
        ibge.quarter_start("202505")


def test_parse_sidra_skips_missing_values():
    payload = [
        {"NC": "Nível", "V": "Valor"},
        {"NC": "1", "D1C": "1", "D3C": "202503", "D3N": "3º trimestre 2025", "V": "5.6"},
        {"NC": "3", "D1C": "35", "D3C": "202503", "D3N": "3º trimestre 2025", "V": "5.1"},
        {"NC": "3", "D1C": "11", "D3C": "202503", "D3N": "3º trimestre 2025", "V": "..."},
    ]
    rows = ibge.parse_sidra_unemployment(payload)
    assert [(r.territory_level, r.territory_code, r.value) for r in rows] == [("BR", "BR", 5.6), ("UF", "35", 5.1)]


def test_municipality_map_uses_six_digit_prefix():
    t = [ibge.Territory("3550308", "MUNICIPALITY", "São Paulo", "35", "SP", "Sudeste")]
    assert ibge.municipality_map(t) == {"355030": "3550308"}


def test_only_official_hosts_are_allowed():
    assert_allowed("ftp://ftp.mtps.gov.br/pdet/microdados/x.7z")
    assert_allowed("https://servicodados.ibge.gov.br/api/v1/localidades/estados")
    with pytest.raises(ValueError):
        assert_allowed("https://exemplo.com/dados.csv")


def test_rais_section_from_cnae_class():
    assert rais.section_from_class("47.81-4") == "G"
    assert rais.section_from_class("6201-5") == "J"
    assert rais.section_from_class("x") is None


def test_db_config_strips_prisma_schema_param(monkeypatch):
    monkeypatch.setenv("PIPELINE_DATABASE_URL", "postgresql://u:p@localhost:5433/db?schema=public")
    assert db_config().dsn == "postgresql://u:p@localhost:5433/db"
