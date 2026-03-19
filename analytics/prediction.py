"""
analytics/prediction.py – Prediction & metrics engine for Smart Parking.

Uses scikit-learn LinearRegression on historical session data to predict
future availability and computes live metrics.
"""

import math
import random
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_analytics(sessions: list, total_slots: int = 50) -> dict:
    """
    Accepts the full session list from the DB and returns a dict with:
        - occupied / available / available_pct
        - predicted_available_10min  (Linear Regression forecast)
        - peak_hour                  (busiest hour label)
        - avg_occupancy_rate         (percentage)
        - hourly_usage               (list of 24 counts)
        - daily_occupancy            (last 7 day averages)
    """
    now = datetime.now()

    # ── current counts ──────────────────────────────────────────────────
    open_sessions = [s for s in sessions if s.get("exit_time") is None]
    occupied = len(open_sessions)
    available = total_slots - occupied
    available_pct = round(available / total_slots * 100, 1)

    # ── hourly usage (entries per hour across all data) ─────────────────
    hourly_usage = [0] * 24
    for s in sessions:
        try:
            h = datetime.fromisoformat(s["entry_time"]).hour
            hourly_usage[h] += 1
        except Exception:
            pass

    peak_hour_idx = int(np.argmax(hourly_usage)) if any(hourly_usage) else 12
    peak_hour = f"{peak_hour_idx:02d}:00 – {(peak_hour_idx + 1) % 24:02d}:00"

    # ── avg occupancy rate ─────────────────────────────────────────────
    if sessions:
        # Total duration in minutes of all completed sessions
        total_duration = sum(s.get("duration_min", 0) or 0 for s in sessions)
        # Determine time span covered (in minutes)
        try:
            dates = [datetime.fromisoformat(s["entry_time"]) for s in sessions]
            span_minutes = max((max(dates) - min(dates)).total_seconds() / 60, 1)
        except Exception:
            span_minutes = 1440  # fallback: 1 day
        # capacity = total_slots * span_minutes
        avg_occupancy_rate = round(
            min(total_duration / (total_slots * span_minutes) * 100, 100), 1
        )
    else:
        avg_occupancy_rate = 0.0

    # ── daily occupancy (last 7 days) ──────────────────────────────────
    daily_occupancy = _daily_occupancy(sessions, total_slots)

    # ── 10-minute prediction via Linear Regression ─────────────────────
    predicted = _predict_availability_10min(sessions, total_slots, occupied)

    return {
        "total_slots": total_slots,
        "occupied": occupied,
        "available": available,
        "available_pct": available_pct,
        "predicted_available_10min": predicted,
        "peak_hour": peak_hour,
        "avg_occupancy_rate": avg_occupancy_rate,
        "hourly_usage": hourly_usage,
        "daily_occupancy": daily_occupancy,
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _predict_availability_10min(sessions, total_slots, current_occupied):
    """
    Train a simple Linear Regression on a rolling window of session
    counts (bucketed per minute) and predict occupancy 10 minutes ahead.
    Falls back to current occupancy when insufficient data.
    """
    if len(sessions) < 3:
        return max(total_slots - current_occupied, 0)

    now = datetime.now()
    # Build minute-level occupancy for the last 2 hours
    window_start = now - timedelta(hours=2)

    # Collect 'change events' in this window
    events = []
    for s in sessions:
        try:
            entry = datetime.fromisoformat(s["entry_time"])
            if entry >= window_start:
                minutes_offset = (entry - window_start).total_seconds() / 60
                events.append((minutes_offset, +1))
            if s.get("exit_time"):
                ext = datetime.fromisoformat(s["exit_time"])
                if ext >= window_start:
                    minutes_offset = (ext - window_start).total_seconds() / 60
                    events.append((minutes_offset, -1))
        except Exception:
            continue

    if len(events) < 2:
        return max(total_slots - current_occupied, 0)

    events.sort()
    X, y = [], []
    cumulative = 0
    for t, delta in events:
        cumulative += delta
        X.append([t])
        y.append(cumulative)

    model = LinearRegression()
    model.fit(np.array(X), np.array(y))

    future_offset = (now - window_start).total_seconds() / 60 + 10
    predicted_delta = model.predict(np.array([[future_offset]]))[0]
    predicted_occupied = max(0, min(total_slots, current_occupied + int(round(predicted_delta - cumulative))))
    return max(total_slots - predicted_occupied, 0)


def _daily_occupancy(sessions, total_slots):
    """Return list of {date, avg_occupancy_pct} for the last 7 days."""
    today = datetime.now().date()
    result = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.isoformat()
        count = 0
        for s in sessions:
            try:
                entry = datetime.fromisoformat(s["entry_time"]).date()
                if entry == day:
                    count += 1
            except Exception:
                pass
        pct = round(count / total_slots * 100, 1) if total_slots else 0
        result.append({"date": day_str, "avg_occupancy_pct": pct})
    return result


# ---------------------------------------------------------------------------
# Seed helper – generate realistic mock history
# ---------------------------------------------------------------------------

def generate_mock_history(total_slots=50, days=7):
    """
    Generate ~200 fake session rows covering the last `days` days.
    Returns a list of dicts ready for DB insertion.
    Used only once to bootstrap the analytics so predictions work from the start.
    """
    sessions = []
    now = datetime.now()
    for d in range(days, 0, -1):
        base = now - timedelta(days=d)
        n_entries = random.randint(20, 40)
        for _ in range(n_entries):
            hour = random.choices(range(24), weights=_hour_weights())[0]
            minute = random.randint(0, 59)
            entry = base.replace(hour=hour, minute=minute, second=0, microsecond=0)
            dur = random.randint(10, 180)
            exit_time = entry + timedelta(minutes=dur)
            slot_id = random.randint(1, total_slots)
            floor = 1 if slot_id <= 25 else 2
            sessions.append({
                "slot_id": slot_id,
                "entry_time": entry.isoformat(),
                "exit_time": exit_time.isoformat(),
                "duration_min": dur,
                "floor": floor,
            })
    return sessions


def _hour_weights():
    """Probability weights per hour to mimic realistic parking patterns."""
    weights = [1] * 24
    # Morning rush
    for h in [7, 8, 9]:
        weights[h] = 8
    # Midday
    for h in [10, 11, 12, 13, 14]:
        weights[h] = 6
    # Evening rush
    for h in [17, 18]:
        weights[h] = 7
    # Night
    for h in [22, 23, 0, 1, 2, 3, 4, 5]:
        weights[h] = 1
    return weights
