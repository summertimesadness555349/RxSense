#!/usr/bin/env python3
"""
Update the drugs table with DrugBank names when a generic matches
DrugBank names or synonyms.

Defaults assume:
- drugs table:        drugs
- drugs columns:      id, generic, usan_name
- drugbank table:     drugbank_drug
- drugbank columns:   name, synonyms (JSONB array of strings)

Usage:
  DATABASE_URL=postgresql://... \
    python extra/update_drugs_from_drugbank.py

    python extra/update_drugs_from_drugbank.py \
        --drug-table drug --drug-id-column drug_id \
        --generic-column generic_name --name-column usan_name
"""

from __future__ import annotations

import argparse
import os
import re
import sys


try:
    import psycopg  # type: ignore

    def _connect(db_url: str):
        return psycopg.connect(db_url)

    DB_LIB = "psycopg"
except Exception:  # pragma: no cover - fallback only
    try:
        import psycopg2  # type: ignore

        def _connect(db_url: str):
            return psycopg2.connect(db_url)

        DB_LIB = "psycopg2"
    except Exception as exc:  # pragma: no cover - fallback only
        raise SystemExit(
            "Missing database driver. Install psycopg (v3) or psycopg2."
        ) from exc


IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

# Optional: set a default DB URL here. If empty, DATABASE_URL env var is used.
# DB_URL = os.getenv("DATABASE_URL", "")
DB_URL = "postgresql://neondb_owner:npg_6IMdWpcP0lVq@ep-solitary-dew-ao9zktjd-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"


def _validate_identifier(value: str, label: str) -> str:
    parts = value.split(".")
    if not all(IDENT_RE.match(p) for p in parts):
        raise SystemExit(
            f"Invalid {label}: {value}. Use only letters, numbers, and underscores."
        )
    return value


def _build_sql(
    drug_table: str,
    drug_id_col: str,
    generic_col: str,
    name_col: str,
    drugbank_table: str,
    drugbank_name_col: str,
    drugbank_syn_col: str,
    min_generic_len: int,
    only_missing: bool,
) -> tuple[str, str]:
    missing_clause = ""
    if only_missing:
        missing_clause = (
            f"AND (d.{name_col} IS NULL OR btrim(d.{name_col}) = '')"
        )

    matches_cte = f"""
WITH matches AS (
    SELECT
        d.{drug_id_col} AS drug_id,
        dbd.{drugbank_name_col} AS drugbank_name,
        ROW_NUMBER() OVER (
            PARTITION BY d.{drug_id_col}
            ORDER BY
                CASE
                    WHEN lower(dbd.{drugbank_name_col}) = lower(d.{generic_col}) THEN 0
                    WHEN dbd.{drugbank_name_col} ILIKE d.{generic_col} || '%' THEN 1
                    WHEN dbd.{drugbank_name_col} ILIKE '%' || d.{generic_col} THEN 2
                    ELSE 3
                END,
                length(dbd.{drugbank_name_col})
        ) AS rn
    FROM {drug_table} d
    JOIN {drugbank_table} dbd
        ON (
            dbd.{drugbank_name_col} ILIKE '%' || d.{generic_col} || '%'
            OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(
                    COALESCE(dbd.{drugbank_syn_col}, '[]'::jsonb)
                ) s
                WHERE s ILIKE '%' || d.{generic_col} || '%'
            )
        )
    WHERE d.{generic_col} IS NOT NULL
        AND btrim(d.{generic_col}) <> ''
        AND char_length(btrim(d.{generic_col})) >= {min_generic_len}
)
""".strip()

    update_sql = f"""
{matches_cte}
UPDATE {drug_table} d
SET {name_col} = m.drugbank_name
FROM matches m
WHERE d.{drug_id_col} = m.drug_id
    AND m.rn = 1
    {missing_clause}
    AND d.{name_col} IS DISTINCT FROM m.drugbank_name;
""".strip()

    count_sql = f"""
{matches_cte}
SELECT count(*)
FROM {drug_table} d
JOIN matches m ON d.{drug_id_col} = m.drug_id
WHERE m.rn = 1
    {missing_clause}
    AND d.{name_col} IS DISTINCT FROM m.drugbank_name;
""".strip()

    return update_sql, count_sql


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Populate drugs.name from drugbank_drug.name when generic matches "
            "DrugBank name or synonyms."
        )
    )
    parser.add_argument("--db-url", default=DB_URL or None)
    parser.add_argument("--drug-table", default="drugs")
    parser.add_argument("--drug-id-column", default="id")
    parser.add_argument("--generic-column", default="generic")
    parser.add_argument("--name-column", default="usan_name")
    parser.add_argument("--drugbank-table", default="drugbank_drug")
    parser.add_argument("--drugbank-name-column", default="name")
    parser.add_argument("--drugbank-synonyms-column", default="synonyms")
    parser.add_argument(
        "--min-generic-length",
        type=int,
        default=2,
        help="Ignore very short generics to reduce false matches.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing name values (default: only fill missing).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print how many rows would be updated and exit.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()

    if not args.db_url:
        print("DATABASE_URL is required (env var or --db-url).", file=sys.stderr)
        return 1

    if args.min_generic_length < 1:
        print("--min-generic-length must be >= 1", file=sys.stderr)
        return 1

    drug_table = _validate_identifier(args.drug_table, "drug table")
    drug_id_col = _validate_identifier(args.drug_id_column, "drug id column")
    generic_col = _validate_identifier(args.generic_column, "generic column")
    name_col = _validate_identifier(args.name_column, "name column")
    drugbank_table = _validate_identifier(args.drugbank_table, "drugbank table")
    drugbank_name_col = _validate_identifier(
        args.drugbank_name_column, "drugbank name column"
    )
    drugbank_syn_col = _validate_identifier(
        args.drugbank_synonyms_column, "drugbank synonyms column"
    )

    update_sql, count_sql = _build_sql(
        drug_table=drug_table,
        drug_id_col=drug_id_col,
        generic_col=generic_col,
        name_col=name_col,
        drugbank_table=drugbank_table,
        drugbank_name_col=drugbank_name_col,
        drugbank_syn_col=drugbank_syn_col,
        min_generic_len=args.min_generic_length,
        only_missing=not args.overwrite,
    )

    print(f"[INFO] Using {DB_LIB} driver")

    with _connect(args.db_url) as conn:
        with conn.cursor() as cur:
            if args.dry_run:
                cur.execute(count_sql)
                count = cur.fetchone()[0]
                print(f"[DRY RUN] Rows to update: {count}")
                conn.rollback()
                return 0

            cur.execute(update_sql)
            updated = cur.rowcount
            conn.commit()

    print(f"[OK] Updated rows: {updated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
