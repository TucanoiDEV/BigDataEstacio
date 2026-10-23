"""Carga no PostgreSQL. Cada execução gera um registro DataImport e um StatDataset
em estado STAGED — a publicação no observatório é uma decisão humana (painel admin)."""

from __future__ import annotations

import json
import secrets
import string
from contextlib import contextmanager
from datetime import date
from typing import Iterable, Iterator

import psycopg

from . import PIPELINE_VERSION
from .config import db_config

_ALPHABET = string.ascii_lowercase + string.digits


def new_id() -> str:
    """Identificador compatível com os IDs (cuid) usados pela aplicação."""
    return "c" + "".join(secrets.choice(_ALPHABET) for _ in range(24))


@contextmanager
def connect() -> Iterator[psycopg.Connection]:
    with psycopg.connect(db_config().dsn, autocommit=False) as conn:
        yield conn


def start_import(conn: psycopg.Connection, source: str, description: str) -> str:
    import_id = new_id()
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "DataImport" (id, source, description, status, files, "pipelineVersion") VALUES (%s, %s, %s, %s, %s, %s)',
            (import_id, source, description, "RUNNING", json.dumps([]), PIPELINE_VERSION),
        )
    conn.commit()
    return import_id


def finish_import(conn: psycopg.Connection, import_id: str, *, ok: bool, files: list[dict], read: int, valid: int, rejected: int, error: str | None = None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "DataImport" SET status=%s, "finishedAt"=now(), files=%s, "rowsRead"=%s, "rowsValid"=%s, "rowsRejected"=%s, "errorSummary"=%s WHERE id=%s',
            ("SUCCEEDED" if ok else "FAILED", json.dumps(files), read, valid, rejected, (error or "")[:2000] or None, import_id),
        )
    conn.commit()


def create_dataset(
    conn: psycopg.Connection,
    *,
    import_id: str,
    source: str,
    title: str,
    reference_start: date,
    reference_end: date,
    source_url: str,
    methodology_url: str,
    methodology_notes: str,
    license_text: str,
) -> str:
    ds_id = new_id()
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "StatDataset" (id, "importId", source, title, "referenceStart", "referenceEnd", "sourceUrl", "methodologyUrl", "methodologyNotes", license, status) '
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'STAGED')",
            (ds_id, import_id, source, title, reference_start, reference_end, source_url, methodology_url, methodology_notes, license_text),
        )
    return ds_id


def latest_dataset(conn: psycopg.Connection, source: str) -> tuple[str, date, str] | None:
    """Conjunto mais recente (em revisão ou publicado) de uma fonte: (id, referenceEnd, status)."""
    with conn.cursor() as cur:
        cur.execute(
            'SELECT d.id, d."referenceEnd", d.status FROM "StatDataset" d JOIN "DataImport" i ON i.id = d."importId" '
            "WHERE d.source = %s AND d.status IN ('STAGED','PUBLISHED') AND i.status = 'SUCCEEDED' "
            'ORDER BY d."referenceEnd" DESC, d."createdAt" DESC LIMIT 1',
            (source,),
        )
        row = cur.fetchone()
    return (row[0], row[1], row[2]) if row else None


def latest_published_indicator_period(conn: psycopg.Connection, indicator: str) -> str | None:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT max(i."periodCode") FROM "StatIndicator" i JOIN "StatDataset" d ON d.id = i."datasetId" '
            "WHERE i.indicator = %s AND d.status IN ('STAGED','PUBLISHED')",
            (indicator,),
        )
        row = cur.fetchone()
    return row[0] if row else None


def publish_dataset(conn: psycopg.Connection, dataset_id: str, source: str, reason: dict) -> None:
    """Publica o conjunto (arquivando o anterior da mesma fonte) e registra na auditoria."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE \"StatDataset\" SET status='ARCHIVED' WHERE source=%s AND status='PUBLISHED' AND id <> %s",
            (source, dataset_id),
        )
        cur.execute("UPDATE \"StatDataset\" SET status='PUBLISHED', \"publishedAt\"=now() WHERE id=%s", (dataset_id,))
        cur.execute(
            'INSERT INTO "AuditLog" (id, action, "targetType", "targetId", metadata) VALUES (%s, %s, %s, %s, %s)',
            (new_id(), "pipeline.dataset_auto_published", "StatDataset", dataset_id, json.dumps(reason)),
        )
    conn.commit()


def prune_archived(conn: psycopg.Connection, source: str, keep: int = 3) -> int:
    """Remove conjuntos arquivados antigos (mantém os `keep` mais recentes por fonte)."""
    with conn.cursor() as cur:
        cur.execute(
            'DELETE FROM "StatDataset" WHERE id IN ('
            "  SELECT id FROM \"StatDataset\" WHERE source = %s AND status = 'ARCHIVED' "
            '  ORDER BY "createdAt" DESC OFFSET %s)',
            (source, keep),
        )
        removed = cur.rowcount
    conn.commit()
    return removed


def upsert_territories(conn: psycopg.Connection, items: Iterable) -> int:
    rows = [(t.code, t.level, t.name, t.uf_code, t.uf_abbr, t.region_name) for t in items]
    with conn.cursor() as cur:
        cur.executemany(
            'INSERT INTO "StatTerritory" (code, level, name, "ufCode", "ufAbbr", "regionName") VALUES (%s,%s,%s,%s,%s,%s) '
            'ON CONFLICT (code) DO UPDATE SET level=EXCLUDED.level, name=EXCLUDED.name, "ufCode"=EXCLUDED."ufCode", "ufAbbr"=EXCLUDED."ufAbbr", "regionName"=EXCLUDED."regionName"',
            rows,
        )
    return len(rows)


def upsert_classifications(conn: psycopg.Connection, system: str, items: dict[str, str]) -> int:
    with conn.cursor() as cur:
        cur.executemany(
            'INSERT INTO "StatClassification" (system, code, title) VALUES (%s,%s,%s) ON CONFLICT (system, code) DO UPDATE SET title=EXCLUDED.title',
            [(system, k, v) for k, v in items.items()],
        )
    return len(items)


def copy_flows(conn: psycopg.Connection, dataset_id: str, rows: Iterable[tuple]) -> int:
    """COPY em lote (rápido e parametrizado pelo protocolo — sem SQL concatenado)."""
    n = 0
    with conn.cursor() as cur:
        with cur.copy(
            'COPY "StatEmploymentFlow" (id, "datasetId", period, "territoryLevel", "territoryCode", "sectorCode", "occupationCode", admissions, separations, balance, "medianAdmissionWage", "wageSampleSize") FROM STDIN'
        ) as cp:
            for r in rows:
                cp.write_row((new_id(), dataset_id, *r))
                n += 1
    return n


def insert_indicators(conn: psycopg.Connection, dataset_id: str, indicator: str, unit: str, rows: Iterable) -> int:
    data = [
        (new_id(), dataset_id, indicator, r.period_code, r.period_label, r.period_start, r.territory_level, r.territory_code, r.value, unit)
        for r in rows
    ]
    with conn.cursor() as cur:
        cur.executemany(
            'INSERT INTO "StatIndicator" (id, "datasetId", indicator, "periodCode", "periodLabel", "periodStart", "territoryLevel", "territoryCode", value, unit) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
            data,
        )
    return len(data)
