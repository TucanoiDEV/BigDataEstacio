"""Linha de comando do pipeline.

Exemplos:
  python -m emprego_pipeline ibge                       # territórios, CNAE, CBO e malha das UFs
  python -m emprego_pipeline pnad                       # taxa de desocupação (PNAD Contínua)
  python -m emprego_pipeline caged --de 202509 --ate 202608
  python -m emprego_pipeline status
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import date

import polars as pl

from . import caged, ibge, load
from .config import AGG_DIR, MAX_REJECTED_RATIO, REPO_ROOT

CAGED_SOURCE_URL = "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/novo-caged"
CAGED_METHOD_URL = "ftp://ftp.mtps.gov.br/pdet/microdados/NOVO%20CAGED/Sobre%20o%20Novo%20Caged.pdf"
CAGED_NOTES = (
    "Movimentações de emprego formal (admissões e desligamentos) declaradas ao eSocial/CAGED. "
    "Série 'com ajustes': cada competência soma as declarações no prazo (MOV), as declarações fora do prazo "
    "recebidas nos meses seguintes (FOR) e subtrai as exclusões (EXC), até a última competência importada. "
    "Competências recentes podem ser revistas. Saldo = admissões − desligamentos. "
    "Salário: MEDIANA do salário contratual de admissão, apenas mensalistas não intermitentes, entre 0,3 e 150 "
    "salários mínimos, publicada somente com amostra ≥ 30 (difere da média divulgada pelo MTE). "
    "Não representa vagas anunciadas nem estoque de empregos. Municípios: código CAGED de 6 dígitos mapeado "
    "para o código IBGE de 7 dígitos; registros de território não identificado entram apenas no total Brasil. "
    "Atributos pessoais dos microdados (sexo, raça/cor, idade, escolaridade, deficiência) não são processados."
)
LICENSE = "Dados abertos do Governo Federal — uso livre com citação da fonte (Ministério do Trabalho e Emprego / PDET)."


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def comp_to_date(comp: int) -> date:
    return date(comp // 100, comp % 100, 1)


def cmd_ibge(_args) -> int:
    with load.connect() as conn:
        import_id = load.start_import(conn, "IBGE", "Territórios (Localidades), seções CNAE 2.0, grandes grupos CBO e malha das UFs")
        files: list[dict] = []
        try:
            territories, tfiles = ibge.fetch_territories()
            sections, sfile = ibge.fetch_cnae_sections()
            geo = ibge.fetch_uf_geojson(REPO_ROOT / "public" / "geo" / "br-uf.json")
            files = [f.as_record() for f in [*tfiles, sfile, geo]]
            n_t = load.upsert_territories(conn, territories)
            n_c = load.upsert_classifications(conn, "CNAE2_SECAO", sections)
            n_o = load.upsert_classifications(conn, "CBO2002_GRANDE_GRUPO", ibge.CBO_GRANDES_GRUPOS)
            conn.commit()
            load.finish_import(conn, import_id, ok=True, files=files, read=n_t + n_c + n_o, valid=n_t + n_c + n_o, rejected=0)
            log(f"IBGE ok: {n_t} territórios, {n_c} seções CNAE, {n_o} grupos CBO, malha UF em public/geo/br-uf.json")
            return 0
        except Exception as err:
            conn.rollback()
            load.finish_import(conn, import_id, ok=False, files=files, read=0, valid=0, rejected=0, error=str(err))
            raise


def cmd_pnad(_args) -> int:
    with load.connect() as conn:
        import_id = load.start_import(conn, "IBGE", "PNAD Contínua — taxa de desocupação trimestral (SIDRA tabela 4099)")
        files: list[dict] = []
        try:
            rows, f = ibge.fetch_unemployment()
            files = [f.as_record()]
            starts = sorted({r.period_start for r in rows})
            ds = load.create_dataset(
                conn,
                import_id=import_id,
                source="IBGE",
                title="PNAD Contínua — taxa de desocupação (14 anos ou mais)",
                reference_start=starts[0],
                reference_end=starts[-1],
                source_url="https://sidra.ibge.gov.br/tabela/4099",
                methodology_url="https://www.ibge.gov.br/estatisticas/sociais/trabalho/9171-pesquisa-nacional-por-amostra-de-domicilios-continua-mensal.html",
                methodology_notes="Pesquisa amostral domiciliar do IBGE. Taxa de desocupação = desocupados / força de trabalho, na semana de referência, pessoas de 14 anos ou mais. Estimativas trimestrais, sujeitas a erro amostral.",
                license_text="Dados públicos do IBGE — uso livre com citação da fonte.",
            )
            n = load.insert_indicators(conn, ds, "PNADC_TAXA_DESOCUPACAO", "%", rows)
            conn.commit()
            load.finish_import(conn, import_id, ok=True, files=files, read=n, valid=n, rejected=0)
            log(f"PNAD ok: {n} valores em dataset {ds} (STAGED — publique no painel admin)")
            return 0
        except Exception as err:
            conn.rollback()
            load.finish_import(conn, import_id, ok=False, files=files, read=0, valid=0, rejected=0, error=str(err))
            raise


def _mun_map(conn) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute('SELECT code FROM "StatTerritory" WHERE level = %s', ("MUNICIPALITY",))
        codes = [r[0] for r in cur.fetchall()]
    if len(codes) < 5000:
        raise SystemExit("Territórios do IBGE não carregados. Rode primeiro: python -m emprego_pipeline ibge")
    return {c[:6]: c for c in codes}


def cmd_caged(args) -> int:
    months = caged.month_range(args.de, args.ate)
    with load.connect() as conn:
        mun_map = _mun_map(conn)
        import_id = load.start_import(conn, "NOVO_CAGED", f"Novo CAGED — competências {args.de} a {args.ate}")
        files: list[dict] = []
        try:
            curated = []
            for comp in months:
                log(f"Competência {comp}: baixando arquivos oficiais")
                fetched = caged.fetch_month(comp)
                files.extend(f.as_record() for f in fetched)
                for f in fetched:
                    log(f"  curando {f.name} ({f.bytes / 1e6:.1f} MB, sha256 {f.sha256[:12]}…)")
                    curated.append(caged.curate_file(f.path, mun_map))

            valid, stats = caged.load_curated(curated, args.de, args.ate)
            log(f"Linhas no período: {stats.read:,} · válidas {stats.valid:,} · rejeitadas {stats.rejected:,}")
            if stats.read == 0:
                raise RuntimeError("Nenhuma linha no período informado")
            if stats.rejected / stats.read > MAX_REJECTED_RATIO:
                raise RuntimeError(f"Taxa de rejeição {stats.rejected / stats.read:.2%} acima do limite {MAX_REJECTED_RATIO:.0%}")

            log("Agregando por Brasil, UF (total/seção/ocupação) e município")
            agg = caged.aggregate(valid)
            AGG_DIR.mkdir(parents=True, exist_ok=True)
            agg_path = AGG_DIR / f"novo_caged_{args.de}_{args.ate}.parquet"
            agg.write_parquet(agg_path)

            # Verificação de consistência: soma das UFs <= total Brasil (BR inclui "não identificado").
            check = agg.filter((pl.col("sector_code") == "*") & (pl.col("occupation_code") == "*"))
            br = check.filter(pl.col("territory_level") == "BR").select(pl.col("admissions").sum()).item()
            uf = check.filter(pl.col("territory_level") == "UF").select(pl.col("admissions").sum()).item()
            if uf > br:
                raise RuntimeError("Inconsistência: soma das UFs maior que o total Brasil")

            ds = load.create_dataset(
                conn,
                import_id=import_id,
                source="NOVO_CAGED",
                title=f"Novo CAGED — {comp_to_date(args.de):%m/%Y} a {comp_to_date(args.ate):%m/%Y} (com ajustes até {comp_to_date(args.ate):%m/%Y})",
                reference_start=comp_to_date(args.de),
                reference_end=comp_to_date(args.ate),
                source_url=CAGED_SOURCE_URL,
                methodology_url=CAGED_METHOD_URL,
                methodology_notes=CAGED_NOTES,
                license_text=LICENSE,
            )
            rows = (
                (
                    comp_to_date(r["competencia"]),
                    r["territory_level"],
                    r["territory_code"],
                    r["sector_code"],
                    r["occupation_code"],
                    r["admissions"],
                    r["separations"],
                    r["balance"],
                    r["wage_median"],
                    r["wage_n"],
                )
                for r in agg.iter_rows(named=True)
            )
            n = load.copy_flows(conn, ds, rows)
            conn.commit()
            load.finish_import(conn, import_id, ok=True, files=files, read=stats.read, valid=stats.valid, rejected=stats.rejected)
            log(f"CAGED ok: {n:,} agregados carregados no dataset {ds} (STAGED — publique no painel admin)")
            return 0
        except Exception as err:
            conn.rollback()
            load.finish_import(conn, import_id, ok=False, files=files, read=0, valid=0, rejected=0, error=str(err))
            raise


def cmd_status(_args) -> int:
    with load.connect() as conn, conn.cursor() as cur:
        cur.execute('SELECT source, status, "startedAt", "rowsValid", "rowsRejected", description FROM "DataImport" ORDER BY "startedAt" DESC LIMIT 15')
        for row in cur.fetchall():
            print(" | ".join(str(x) for x in row))
        cur.execute('SELECT source, status, title, "referenceStart", "referenceEnd" FROM "StatDataset" ORDER BY "createdAt" DESC LIMIT 15')
        print("\nDatasets:")
        for row in cur.fetchall():
            print(" | ".join(str(x) for x in row))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="emprego_pipeline", description="Ingestão de dados oficiais do mercado de trabalho")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("ibge", help="Territórios, classificações e malha das UFs").set_defaults(fn=cmd_ibge)
    sub.add_parser("pnad", help="Taxa de desocupação — PNAD Contínua (SIDRA)").set_defaults(fn=cmd_pnad)
    p = sub.add_parser("caged", help="Microdados do Novo CAGED")
    p.add_argument("--de", type=int, required=True, help="Competência inicial AAAAMM")
    p.add_argument("--ate", type=int, required=True, help="Competência final AAAAMM")
    p.set_defaults(fn=cmd_caged)
    sub.add_parser("status", help="Últimas importações").set_defaults(fn=cmd_status)
    args = parser.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
