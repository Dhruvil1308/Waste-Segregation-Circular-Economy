"""
Migration to the three-role community model (generator / collector / admin).

Adds the new columns and tables, then rewrites the legacy vocabulary in place:

    roles     urban -> generator, cooperative -> collector
    statuses  available -> requested, scheduled -> accepted

Safe to run more than once. Usage:

    python migrate_v3.py
"""
import os
import sqlite3
import secrets

from backend import models, database

DB_PATH = os.path.join(database.PROJECT_ROOT, "marketplace_v2.db")

# table -> (column, SQL type) to add if missing
NEW_COLUMNS = {
    "users": [
        ("latitude", "FLOAT"),
        ("longitude", "FLOAT"),
        ("service_radius_km", "FLOAT DEFAULT 5.0"),
    ],
    "waste_listings": [
        ("category", "VARCHAR"),
        ("latitude", "FLOAT"),
        ("longitude", "FLOAT"),
        ("collector_id", "INTEGER"),
        ("accepted_at", "DATETIME"),
        ("collected_at", "DATETIME"),
        ("qr_token", "VARCHAR"),
        ("escalated", "BOOLEAN DEFAULT 0"),
    ],
}

ROLE_MAP = {"urban": models.ROLE_GENERATOR, "cooperative": models.ROLE_COLLECTOR}
STATUS_MAP = {"available": models.STATUS_REQUESTED, "scheduled": models.STATUS_ACCEPTED}


def existing_columns(cur, table):
    return {row[1] for row in cur.execute(f"PRAGMA table_info({table})")}


def add_missing_columns(cur):
    added = 0
    for table, columns in NEW_COLUMNS.items():
        present = existing_columns(cur, table)
        for name, sql_type in columns:
            if name not in present:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {name} {sql_type}")
                added += 1
                print(f"  + {table}.{name}")
    return added


def remap(cur, table, column, mapping):
    changed = 0
    for old, new in mapping.items():
        cur.execute(f"UPDATE {table} SET {column}=? WHERE {column}=?", (new, old))
        if cur.rowcount:
            print(f"  {table}.{column}: {old} -> {new} ({cur.rowcount} row(s))")
            changed += cur.rowcount
    return changed


def backfill_qr_tokens(cur):
    rows = cur.execute("SELECT id FROM waste_listings WHERE qr_token IS NULL").fetchall()
    for (listing_id,) in rows:
        cur.execute("UPDATE waste_listings SET qr_token=? WHERE id=?", (secrets.token_urlsafe(16), listing_id))
    if rows:
        print(f"  backfilled {len(rows)} QR token(s)")
    return len(rows)


def migrate():
    # Creates any brand-new tables (tickets, notifications) via SQLAlchemy metadata.
    models.Base.metadata.create_all(bind=database.engine)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    try:
        print("Adding columns...")
        add_missing_columns(cur)

        print("Remapping roles...")
        remap(cur, "users", "role", ROLE_MAP)

        print("Remapping statuses...")
        remap(cur, "waste_listings", "status", STATUS_MAP)

        print("Backfilling QR tokens...")
        backfill_qr_tokens(cur)

        conn.commit()
        print("\nDone.")
        for label, query in [
            ("roles", "SELECT role, COUNT(*) FROM users GROUP BY role"),
            ("statuses", "SELECT status, COUNT(*) FROM waste_listings GROUP BY status"),
        ]:
            print(f"  {label}: {cur.execute(query).fetchall()}")
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
