"""IBGE: territórios, classificações e indicadores (API de Localidades, CNAE e SIDRA)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date

from .config import RAW_DIR
from .download import FetchedFile, fetch

LOCALIDADES = "https://servicodados.ibge.gov.br/api/v1/localidades"
CNAE_SECOES = "https://servicodados.ibge.gov.br/api/v2/cnae/secoes"
MALHA_UF = "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&intrarregiao=UF&qualidade=minima"
# Tabela 4099 do SIDRA: taxa de desocupação (PNAD Contínua trimestral), Brasil e UFs.
SIDRA_DESOCUPACAO = "https://apisidra.ibge.gov.br/values/t/4099/n1/all/n3/all/v/4099/p/last%2012?formato=json"

# Grandes grupos da CBO 2002 (Classificação Brasileira de Ocupações — MTE).
CBO_GRANDES_GRUPOS = {
    "0": "Forças armadas, policiais e bombeiros militares",
    "1": "Dirigentes e gerentes",
    "2": "Profissionais das ciências e das artes",
    "3": "Técnicos de nível médio",
    "4": "Trabalhadores de serviços administrativos",
    "5": "Trabalhadores dos serviços e vendedores do comércio",
    "6": "Trabalhadores agropecuários, florestais e da pesca",
    "7": "Trabalhadores da produção de bens e serviços industriais (7)",
    "8": "Trabalhadores da produção de bens e serviços industriais (8)",
    "9": "Trabalhadores em serviços de reparação e manutenção",
}


@dataclass(frozen=True)
class Territory:
    code: str
    level: str  # BR | REGION | UF | MUNICIPALITY
    name: str
    uf_code: str | None
    uf_abbr: str | None
    region_name: str | None


def _json(f: FetchedFile):
    return json.loads(f.path.read_text(encoding="utf-8"))


def fetch_territories() -> tuple[list[Territory], list[FetchedFile]]:
    ufs_file = fetch(f"{LOCALIDADES}/estados?orderBy=nome", RAW_DIR / "ibge" / "estados.json", force=True)
    mun_file = fetch(f"{LOCALIDADES}/municipios", RAW_DIR / "ibge" / "municipios.json", force=True)
    out = [Territory("BR", "BR", "Brasil", None, None, None)]
    for uf in _json(ufs_file):
        out.append(Territory(str(uf["id"]), "UF", uf["nome"], str(uf["id"]), uf["sigla"], uf["regiao"]["nome"]))
    for m in _json(mun_file):
        # Alguns municípios recém-criados podem vir sem microrregião; a UF vem da região imediata.
        uf = (m.get("microrregiao") or {}).get("mesorregiao", {}).get("UF") or m["regiao-imediata"]["regiao-intermediaria"]["UF"]
        out.append(Territory(str(m["id"]), "MUNICIPALITY", m["nome"], str(uf["id"]), uf["sigla"], uf["regiao"]["nome"]))
    validate_territories(out)
    return out, [ufs_file, mun_file]


def validate_territories(items: list[Territory]) -> None:
    ufs = [t for t in items if t.level == "UF"]
    muns = [t for t in items if t.level == "MUNICIPALITY"]
    if len(ufs) != 27:
        raise ValueError(f"Esperadas 27 UFs, recebidas {len(ufs)}")
    if not 5500 <= len(muns) <= 5700:
        raise ValueError(f"Quantidade de municípios fora do esperado: {len(muns)}")
    bad = [t.code for t in muns if len(t.code) != 7 or not t.code.isdigit()]
    if bad:
        raise ValueError(f"Códigos de município inválidos: {bad[:5]}")


def municipality_map(territories: list[Territory]) -> dict[str, str]:
    """Código CAGED (6 dígitos, sem verificador) -> código IBGE (7 dígitos)."""
    return {t.code[:6]: t.code for t in territories if t.level == "MUNICIPALITY"}


def fetch_cnae_sections() -> tuple[dict[str, str], FetchedFile]:
    f = fetch(CNAE_SECOES, RAW_DIR / "ibge" / "cnae_secoes.json", force=True)
    sections = {s["id"]: s["descricao"].capitalize() for s in _json(f)}
    if len(sections) < 21:
        raise ValueError("Lista de seções CNAE incompleta")
    return sections, f


def fetch_uf_geojson(dest) -> FetchedFile:
    return fetch(MALHA_UF, dest, force=True)


@dataclass(frozen=True)
class IndicatorRow:
    period_code: str
    period_label: str
    period_start: date
    territory_level: str
    territory_code: str
    value: float


def quarter_start(code: str) -> date:
    """'202503' (3º tri/2025) -> 2025-07-01."""
    year, q = int(code[:4]), int(code[4:])
    if not 1 <= q <= 4:
        raise ValueError(f"Trimestre inválido: {code}")
    return date(year, 3 * (q - 1) + 1, 1)


def parse_sidra_unemployment(payload: list[dict]) -> list[IndicatorRow]:
    rows: list[IndicatorRow] = []
    for item in payload[1:]:  # primeira linha é o cabeçalho descritivo
        value = item.get("V")
        if value in (None, "", "-", "...", "X"):
            continue  # sem dado / sigilo: não publicar
        level = "BR" if item["NC"] == "1" else "UF"
        rows.append(
            IndicatorRow(
                period_code=item["D3C"],
                period_label=item["D3N"],
                period_start=quarter_start(item["D3C"]),
                territory_level=level,
                territory_code="BR" if level == "BR" else item["D1C"],
                value=float(value),
            )
        )
    if not rows:
        raise ValueError("SIDRA não retornou valores")
    return rows


def fetch_unemployment() -> tuple[list[IndicatorRow], FetchedFile]:
    f = fetch(SIDRA_DESOCUPACAO, RAW_DIR / "ibge" / "sidra_4099.json", force=True)
    return parse_sidra_unemployment(_json(f)), f
