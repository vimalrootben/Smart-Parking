"""
app.py – Flask application for the Smart Parking Analytics System.
Supports User and Admin roles with separate views.
"""

from flask import Flask, jsonify, render_template, request
from database import (
    init_db, get_all_slots, occupy_slot, free_slot,
    occupy_specific_slot, free_specific_slot, get_floor_stats,
    get_sessions, get_all_sessions, get_connection
)
from analytics.prediction import compute_analytics, generate_mock_history

app = Flask(__name__)


def _seed_once():
    """Insert mock historical sessions if the sessions table is empty."""
    conn = get_connection()
    count = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
    conn.close()
    if count == 0:
        rows = generate_mock_history()
        conn = get_connection()
        c = conn.cursor()
        for r in rows:
            c.execute(
                "INSERT INTO sessions (slot_id, entry_time, exit_time, duration_min, floor) VALUES (?,?,?,?,?)",
                (r["slot_id"], r["entry_time"], r["exit_time"], r["duration_min"], r["floor"]),
            )
        conn.commit()
        conn.close()


# Initialise DB & seed mock history on first run
init_db()
_seed_once()


# ---------------------------------------------------------------------------
# Page routes
# ---------------------------------------------------------------------------
@app.route("/")
def landing():
    """Landing page — redirect or show user view by default."""
    return render_template("user.html")


@app.route("/user")
def user_page():
    """User view: parking layout only with slot booking."""
    return render_template("user.html")


@app.route("/admin")
def admin_page():
    """Admin view: full analytics dashboard + action logs."""
    return render_template("admin.html")


@app.route("/report")
def report_page():
    return render_template("report.html")


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------
@app.route("/api/slots")
def api_slots():
    return jsonify(get_all_slots())


@app.route("/api/floor_stats")
def api_floor_stats():
    """Return per-floor metrics: total, occupied, available."""
    return jsonify(get_floor_stats())


@app.route("/api/enter", methods=["POST"])
def api_enter():
    result = occupy_slot()
    if result is None:
        return jsonify({"error": "Parking lot is full!"}), 400
    return jsonify(result)


@app.route("/api/exit", methods=["POST"])
def api_exit():
    result = free_slot()
    if result is None:
        return jsonify({"error": "No cars to exit!"}), 400
    return jsonify(result)


@app.route("/api/book/<int:slot_id>", methods=["POST"])
def api_book(slot_id):
    """User books a specific slot."""
    result = occupy_specific_slot(slot_id)
    if result is None:
        return jsonify({"error": f"Slot {slot_id} is not available!"}), 400
    return jsonify(result)


@app.route("/api/release/<int:slot_id>", methods=["POST"])
def api_release(slot_id):
    """Release a specific occupied slot."""
    result = free_specific_slot(slot_id)
    if result is None:
        return jsonify({"error": f"Slot {slot_id} is not occupied!"}), 400
    return jsonify(result)


@app.route("/api/analytics")
def api_analytics():
    sessions = get_all_sessions()
    data = compute_analytics(sessions)
    return jsonify(data)


@app.route("/api/sessions")
def api_sessions():
    limit = request.args.get("limit", 100, type=int)
    return jsonify(get_sessions(limit))


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True, port=5000)
