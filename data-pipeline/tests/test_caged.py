"""Testes do processamento do Novo CAGED.

ATENÇÃO: os arquivos abaixo são FIXTURES SINTÉTICAS criadas só para teste, no
mesmo layout dos arquivos oficiais. Não representam dados reais e nunca são
carregados no banco da aplicação.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl
import py7zr
import pytest

from emprego_pipeline import caged

HEADER_MOV = (
    "competênciamov;região;uf;município;seção;subclasse;saldomovimentação;cbo2002ocupação;categoria;graudeinstrução;"
    "idade;horascontratuais;raçacor;sexo;tipoempregador;tipoestabelecimento;tipomovimentação;tipodedeficiência;"
    "indtrabintermitente;indtrabparcial;salário;tamestabjan;indicadoraprendiz;origemdainformação;competênciadec;"
    "indicadordeforadoprazo;unidadesaláriocódigo;valorsaláriofixo"
)
HEADER_EXC = HEADER_MOV.replace("competênciadec;indicadordeforadoprazo", "competênciadec;competênciaexc;indicadordeexclusão;indicadordeforadoprazo")


def mov_row(comp, uf, mun, secao, saldo, cbo, salario, intermitente=0, unidade=5, extra_exc=False):
    base = [comp, 3, uf, mun, secao, "4789099", saldo, cbo, 101, 7, 30, "44,00", 3, 1, 0, 1, 97, 0, intermitente, 0, salario, 99, 0, 1, comp]
    tail = [comp, 1, 0] if extra_exc else [0]
    return ";".join(str(x) for x in base + tail + [unidade, salario])


def write_7z(dir_: Path, name: str, header: str, rows: list[str]) -> Path:
    txt = dir_ / f"{name}.txt"
    txt.write_bytes(("\n".join([header, *rows]) + "\n").encode("latin-1"))
    archive = dir_ / f"{name}.7z"
    with py7zr.SevenZipFile(archive, "w") as z:
        z.write(txt, arcname=txt.name)
    txt.unlink()
    return archive


@pytest.fixture()
def curated(tmp_path, monkeypatch):
    monkeypatch.setattr(caged, "CURATED_DIR", tmp_path / "curated")
    raw = tmp_path / "raw"
    raw.mkdir()
    mun_map = {"355030": "3550308", "330455": "3304557"}
    # Competência 202607 (MOV): 3 admissões e 1 desligamento em SP; 1 admissão no RJ.
    mov_07 = write_7z(raw, "CAGEDMOV202607", HEADER_MOV, [
        mov_row(202607, 35, 355030, "G", 1, "521110", "2000,00"),
        mov_row(202607, 35, 355030, "G", 1, "521110", "2200,00"),
        mov_row(202607, 35, 355030, "J", 1, "212405", "8000,00"),
        mov_row(202607, 35, 355030, "G", -1, "521110", "2100,00"),
        mov_row(202607, 33, 330455, "Q", 1, "322205", "1900,00", intermitente=1),
        "202607;3;35;355030;X1;0;9;521110",  # linha malformada -> rejeitada
    ])
    # Arquivo de 202608: MOV da própria competência, FOR de 202607 e EXC de 202607.
    mov_08 = write_7z(raw, "CAGEDMOV202608", HEADER_MOV, [mov_row(202608, 35, 355030, "G", 1, "521110", "2300,00")])
    for_08 = write_7z(raw, "CAGEDFOR202608", HEADER_MOV, [mov_row(202607, 33, 330455, "Q", 1, "322205", "500000,00")])
    exc_08 = write_7z(raw, "CAGEDEXC202608", HEADER_EXC, [mov_row(202607, 35, 355030, "G", 1, "521110", "2000,00", extra_exc=True)])
    return [caged.curate_file(p, mun_map) for p in (mov_07, mov_08, for_08, exc_08)]


def test_normalize_header_strips_accents():
    assert caged.normalize_header("competênciamov") == "competenciamov"
    assert caged.normalize_header("unidadesaláriocódigo") == "unidadesalariocodigo"


def test_month_range_crosses_year():
    assert caged.month_range(202511, 202602) == [202511, 202512, 202601, 202602]
    with pytest.raises(ValueError):
        caged.month_range(202602, 202601)


def test_curated_layer_has_no_sensitive_attributes(curated):
    cols = set(pl.read_parquet(curated[0]).columns)
    for sensitive in caged.DISCARDED_SENSITIVE:
        assert sensitive not in cols
    assert cols == set(caged.CURATED_COLUMNS)


def test_reconciliation_mov_for_exc(curated, monkeypatch):
    monkeypatch.setattr(caged, "MIN_WAGE_SAMPLE", 1)
    valid, stats = caged.load_curated(curated, 202607, 202608)
    assert stats.rejected == 1
    assert stats.valid == stats.read - 1
    agg = caged.aggregate(valid)

    def total(level, code, comp):
        row = agg.filter(
            (pl.col("territory_level") == level) & (pl.col("territory_code") == code) & (pl.col("competencia") == comp)
            & (pl.col("sector_code") == "*") & (pl.col("occupation_code") == "*")
        )
        return row.select("admissions", "separations", "balance").row(0)

    # 202607 Brasil: 4 admissões MOV + 1 FOR − 1 EXC = 4; 1 desligamento.
    assert total("BR", "BR", 202607) == (4, 1, 3)
    # SP: 3 adm − 1 exclusão = 2; 1 deslig.
    assert total("UF", "35", 202607) == (2, 1, 1)
    # RJ: 1 MOV + 1 FOR (declaração fora do prazo atribuída à competência original).
    assert total("UF", "33", 202607) == (2, 0, 2)
    assert total("MUNICIPALITY", "3304557", 202607) == (2, 0, 2)
    assert total("BR", "BR", 202608) == (1, 0, 1)


def test_wage_median_filters_invalid_values(curated, monkeypatch):
    monkeypatch.setattr(caged, "MIN_WAGE_SAMPLE", 1)
    valid, _ = caged.load_curated(curated, 202607, 202607)
    agg = caged.aggregate(valid)
    rj = agg.filter((pl.col("territory_code") == "33") & (pl.col("sector_code") == "*") & (pl.col("occupation_code") == "*"))
    # Intermitente e R$ 500.000 (> 150 SM) são excluídos -> sem amostra válida.
    assert rj["wage_median"].item() is None
    sp = agg.filter((pl.col("territory_code") == "35") & (pl.col("sector_code") == "G"))
    # Admissões SP/G válidas: 2000 e 2200 (a exclusão não altera a mediana de admissões declaradas).
    assert sp["wage_median"].item() == pytest.approx(2100.0)


def test_wage_hidden_below_minimum_sample(curated):
    valid, _ = caged.load_curated(curated, 202607, 202607)
    agg = caged.aggregate(valid)  # MIN_WAGE_SAMPLE padrão = 30
    assert agg["wage_median"].null_count() == agg.height


def test_layout_validation_rejects_unexpected_header(tmp_path, monkeypatch):
    monkeypatch.setattr(caged, "CURATED_DIR", tmp_path / "curated")
    bad = write_7z(tmp_path, "CAGEDMOV202601", "a;b;c", ["1;2;3"])
    with pytest.raises(ValueError, match="Layout inesperado"):
        caged.curate_file(bad, {})


@pytest.mark.parametrize("encoding", ["utf-8", "latin-1", "utf-8-sig"])
def test_header_accepts_official_encodings(tmp_path, encoding):
    txt = tmp_path / "CAGEDMOV202501.txt"
    txt.write_bytes((HEADER_MOV + chr(10)).encode(encoding))
    header = caged.read_header(txt)
    assert caged.REQUIRED_HEADER <= set(header)
