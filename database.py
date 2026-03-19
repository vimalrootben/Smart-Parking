"""
database.py – SQLite setup for Smart Parking Analytics System.

Tables
------
slots       – 50 parking slots with id, status ('free'/'occupied'), floor.
sessions    – historical log: slot_id, entry_time, exit_time, duration_min, floor.
"""

import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "parking.db")


def get_connection():
    """Return a new SQLite connection with Row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables and seed 50 slots if they don't already exist."""
    conn = get_connection()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS slots (
            id          INTEGER PRIMARY KEY,
            status      TEXT    NOT NULL DEFAULT 'free',
            floor       INTEGER NOT NULL DEFAULT 1,
            vehicle_id  TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            slot_id     INTEGER NOT NULL,
            entry_time  TEXT    NOT NULL,
            exit_time   TEXT,
            duration_min REAL,
            floor       INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (slot_id) REFERENCES slots(id)
        )
    """)

    # Seed 50 slots across 2 floors (25 per floor) if table is empty
    existing = c.execute("SELECT COUNT(*) FROM slots").fetchone()[0]
    if existing == 0:
        for i in range(1, 51):
            floor = 1 if i <= 25 else 2
            c.execute("INSERT INTO slots (id, status, floor) VALUES (?, 'free', ?)", (i, floor))

    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Slot helpers
# ---------------------------------------------------------------------------
def get_all_slots():
    conn = get_connection()
    slots = [dict(row) for row in conn.execute("SELECT * FROM slots ORDER BY id").fetchall()]
    conn.close()
    return slots


def occupy_slot():
    """Find the first free slot, mark it occupied, create a session entry.
    Returns dict with slot info or None if parking is full."""
    conn = get_connection()
    c = conn.cursor()
    row = c.execute("SELECT id, floor FROM slots WHERE status='free' ORDER BY id LIMIT 1").fetchone()
    if row is None:
        conn.close()
        return None
    slot_id, floor = row["id"], row["floor"]
    now = datetime.now().isoformat()
    c.execute("UPDATE slots SET status='occupied' WHERE id=?", (slot_id,))
    c.execute("INSERT INTO sessions (slot_id, entry_time, floor) VALUES (?, ?, ?)",
              (slot_id, now, floor))
    conn.commit()
    conn.close()
    return {"slot_id": slot_id, "floor": floor, "entry_time": now}


def free_slot():
    """Find the first occupied slot, free it, update session with exit time & duration.
    Returns dict with session info or None if lot is empty."""
    conn = get_connection()
    c = conn.cursor()
    row = c.execute("SELECT id, floor FROM slots WHERE status='occupied' ORDER BY id LIMIT 1").fetchone()
    if row is None:
        conn.close()
        return None
    slot_id, floor = row["id"], row["floor"]
    now = datetime.now().isoformat()
    c.execute("UPDATE slots SET status='free' WHERE id=?", (slot_id,))

    # Update the most recent open session for this slot
    session = c.execute(
        "SELECT id, entry_time FROM sessions WHERE slot_id=? AND exit_time IS NULL ORDER BY id DESC LIMIT 1",
        (slot_id,)
    ).fetchone()
    duration = 0.0
    if session:
        entry_dt = datetime.fromisoformat(session["entry_time"])
        exit_dt = datetime.fromisoformat(now)
        duration = round((exit_dt - entry_dt).total_seconds() / 60, 2)
        c.execute("UPDATE sessions SET exit_time=?, duration_min=? WHERE id=?",
                  (now, duration, session["id"]))

    conn.commit()
    conn.close()
    return {"slot_id": slot_id, "floor": floor, "exit_time": now, "duration_min": duration}


def occupy_specific_slot(slot_id):
    """Book a specific slot by ID. Returns dict or None if slot is not free."""
    conn = get_connection()
    c = conn.cursor()
    row = c.execute("SELECT id, floor, status FROM slots WHERE id=?", (slot_id,)).fetchone()
    if row is None or row["status"] != "free":
        conn.close()
        return None
    floor = row["floor"]
    now = datetime.now().isoformat()
    c.execute("UPDATE slots SET status='occupied' WHERE id=?", (slot_id,))
    c.execute("INSERT INTO sessions (slot_id, entry_time, floor) VALUES (?, ?, ?)",
              (slot_id, now, floor))
    conn.commit()
    conn.close()
    return {"slot_id": slot_id, "floor": floor, "entry_time": now}


def free_specific_slot(slot_id):
    """Free a specific slot by ID. Returns dict or None if slot is not occupied."""
    conn = get_connection()
    c = conn.cursor()
    row = c.execute("SELECT id, floor, status FROM slots WHERE id=?", (slot_id,)).fetchone()
    if row is None or row["status"] != "occupied":
        conn.close()
        return None
    floor = row["floor"]
    now = datetime.now().isoformat()
    c.execute("UPDATE slots SET status='free' WHERE id=?", (slot_id,))
    session = c.execute(
        "SELECT id, entry_time FROM sessions WHERE slot_id=? AND exit_time IS NULL ORDER BY id DESC LIMIT 1",
        (slot_id,)
    ).fetchone()
    duration = 0.0
    if session:
        entry_dt = datetime.fromisoformat(session["entry_time"])
        exit_dt = datetime.fromisoformat(now)
        duration = round((exit_dt - entry_dt).total_seconds() / 60, 2)
        c.execute("UPDATE sessions SET exit_time=?, duration_min=? WHERE id=?",
                  (now, duration, session["id"]))
    conn.commit()
    conn.close()
    return {"slot_id": slot_id, "floor": floor, "exit_time": now, "duration_min": duration}


def get_floor_stats():
    """Return per-floor stats: {floor: {total, occupied, available}}."""
    conn = get_connection()
    slots = [dict(r) for r in conn.execute("SELECT * FROM slots ORDER BY id").fetchall()]
    conn.close()
    stats = {}
    for s in slots:
        f = s["floor"]
        if f not in stats:
            stats[f] = {"total": 0, "occupied": 0, "available": 0}
        stats[f]["total"] += 1
        if s["status"] == "occupied":
            stats[f]["occupied"] += 1
        else:
            stats[f]["available"] += 1
    return stats


# ---------------------------------------------------------------------------
# Reporting helpers
# ---------------------------------------------------------------------------
def get_sessions(limit=100):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM sessions ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_sessions():
    """Return every session row (used by the analytics engine)."""
    conn = get_connection()
    rows = conn.execute("SELECT * FROM sessions ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]
