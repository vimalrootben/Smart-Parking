/* ═══════════════════════════════════════════════════════════════════
   admin.js – Admin dashboard: full analytics + action log + grid
   ═══════════════════════════════════════════════════════════════════ */

let allSlots     = [];
let floorStats   = {};
let currentFloor = 1;
let actionLog    = [];

/* ── Car SVGs ─────────────────────────────────────────────────────── */
const CAR_SVG_DOWN = `<svg class="car-svg car-down" viewBox="0 0 48 80" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="12" width="36" height="56" rx="10" fill="#dc2626"/>
  <rect x="10" y="24" width="28" height="22" rx="6" fill="#1e293b" opacity=".7"/>
  <rect x="12" y="16" width="24" height="10" rx="4" fill="#93c5fd" opacity=".6"/>
  <rect x="12" y="54" width="24" height="8" rx="4" fill="#93c5fd" opacity=".5"/>
  <circle cx="12" cy="14" r="3" fill="#fbbf24"/><circle cx="36" cy="14" r="3" fill="#fbbf24"/>
  <circle cx="12" cy="66" r="2.5" fill="#f87171"/><circle cx="36" cy="66" r="2.5" fill="#f87171"/>
  <rect x="3" y="22" width="6" height="10" rx="3" fill="#1f2937"/>
  <rect x="39" y="22" width="6" height="10" rx="3" fill="#1f2937"/>
  <rect x="3" y="50" width="6" height="10" rx="3" fill="#1f2937"/>
  <rect x="39" y="50" width="6" height="10" rx="3" fill="#1f2937"/>
</svg>`;

const CAR_SVG_UP = `<svg class="car-svg car-up" viewBox="0 0 48 80" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(180deg)">
  <rect x="6" y="12" width="36" height="56" rx="10" fill="#dc2626"/>
  <rect x="10" y="24" width="28" height="22" rx="6" fill="#1e293b" opacity=".7"/>
  <rect x="12" y="16" width="24" height="10" rx="4" fill="#93c5fd" opacity=".6"/>
  <rect x="12" y="54" width="24" height="8" rx="4" fill="#93c5fd" opacity=".5"/>
  <circle cx="12" cy="14" r="3" fill="#fbbf24"/><circle cx="36" cy="14" r="3" fill="#fbbf24"/>
  <circle cx="12" cy="66" r="2.5" fill="#f87171"/><circle cx="36" cy="66" r="2.5" fill="#f87171"/>
  <rect x="3" y="22" width="6" height="10" rx="3" fill="#1f2937"/>
  <rect x="39" y="22" width="6" height="10" rx="3" fill="#1f2937"/>
  <rect x="3" y="50" width="6" height="10" rx="3" fill="#1f2937"/>
  <rect x="39" y="50" width="6" height="10" rx="3" fill="#1f2937"/>
</svg>`;

/* ── Init ──────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => { refreshAll(); });

async function refreshAll() {
  await Promise.all([loadSlots(), loadFloorStats(), loadAnalytics(), loadActionLog()]);
}

/* ── Load Slots ───────────────────────────────────────────────────── */
async function loadSlots() {
  try {
    const res = await fetch("/api/slots");
    allSlots = await res.json();
    renderGrid();
  } catch (e) { console.error(e); }
}

/* ── Load Floor Stats ─────────────────────────────────────────────── */
async function loadFloorStats() {
  try {
    const res = await fetch("/api/floor_stats");
    floorStats = await res.json();
    updateFloorStatsUI();
  } catch (e) { console.error(e); }
}

function updateFloorStatsUI() {
  const f = String(currentFloor);
  const s = floorStats[f] || { total: 0, occupied: 0, available: 0 };
  animateVal("fs-total-val", s.total);
  animateVal("fs-occupied-val", s.occupied);
  animateVal("fs-available-val", s.available);
}

/* ── Load Analytics ───────────────────────────────────────────────── */
async function loadAnalytics() {
  try {
    const res  = await fetch("/api/analytics");
    const data = await res.json();
    animateVal("metric-total", data.total_slots);
    animateVal("metric-occupied", data.occupied);
    animateVal("metric-available", data.available);
    document.getElementById("metric-prediction").textContent = data.predicted_available_10min;
    document.getElementById("metric-prediction-big").textContent = data.predicted_available_10min;
    document.getElementById("metric-peak").textContent  = data.peak_hour;
    document.getElementById("metric-avg").textContent   = data.avg_occupancy_rate + "%";
    renderHourlyChart(data.hourly_usage);
    renderDailyChart(data.daily_occupancy);
  } catch (e) { console.error(e); }
}

/* ── Load Action Log ──────────────────────────────────────────────── */
async function loadActionLog() {
  try {
    const res = await fetch("/api/sessions?limit=20");
    const sessions = await res.json();
    const log = document.getElementById("action-log");
    log.innerHTML = "";
    sessions.forEach((s, i) => {
      const div = document.createElement("div");
      div.className = "log-entry fade-in-row";
      div.style.animationDelay = `${i * 0.03}s`;

      const isActive = !s.exit_time;
      const icon = isActive ? "🚗" : "🚙";
      const action = isActive ? "ENTERED" : "EXITED";
      const time = isActive
        ? formatTime(s.entry_time)
        : `${formatTime(s.exit_time)} (${s.duration_min} min)`;
      const badge = isActive
        ? '<span class="log-badge log-badge--active">Active</span>'
        : '<span class="log-badge log-badge--done">Done</span>';

      div.innerHTML = `
        <span class="log-icon">${icon}</span>
        <span class="log-text">Slot <strong>${s.slot_id}</strong> · Floor ${s.floor} · ${action}</span>
        <span class="log-time">${time}</span>
        ${badge}`;
      log.appendChild(div);
    });
  } catch (e) { console.error(e); }
}

/* ── Render Grid ──────────────────────────────────────────────────── */
function renderGrid() {
  const floorSlots = allSlots.filter(s => s.floor === currentFloor);
  const half = Math.ceil(floorSlots.length / 2);
  renderRow("slot-row-top", floorSlots.slice(0, half), "top");
  renderRow("slot-row-bottom", floorSlots.slice(half), "bottom");
  updateFloorStatsUI();
}

function renderRow(containerId, slots, position) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  const carSvg = position === "top" ? CAR_SVG_DOWN : CAR_SVG_UP;
  slots.forEach(slot => {
    const el = document.createElement("div");
    el.className = `slot-v2 ${slot.status} ${position}`;
    el.id = `slot-${slot.id}`;
    if (slot.status === "occupied") {
      el.innerHTML = carSvg + `<span class="slot-label">OCCUPIED</span>`;
    } else {
      el.innerHTML = `<span class="slot-id-num">${slot.id}</span><span class="slot-label">FREE</span>`;
    }
    container.appendChild(el);
  });
}

/* ── Floor tabs ───────────────────────────────────────────────────── */
function switchFloor(floor) {
  currentFloor = floor;
  document.querySelectorAll(".floor-tab").forEach(t =>
    t.classList.toggle("active", Number(t.dataset.floor) === floor));
  renderGrid();
}

/* ── Car Enter (auto-assign) ──────────────────────────────────────── */
async function carEnter() {
  try {
    const res  = await fetch("/api/enter", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      toast(`🚗 Car entered Slot ${data.slot_id} (Floor ${data.floor})`, "success");
      await refreshAll();
      driveIn(data.slot_id);
    } else { toast(data.error, "error"); }
  } catch (e) { toast("Network error", "error"); }
}

/* ── Car Exit (auto-assign) ───────────────────────────────────────── */
async function carExit() {
  try {
    const occupied = document.querySelector(".slot-v2.occupied");
    if (occupied) { occupied.classList.add("drive-out"); await sleep(450); }
    const res  = await fetch("/api/exit", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      toast(`🚙 Car exited Slot ${data.slot_id} (${data.duration_min} min)`, "success");
      await refreshAll();
    } else { toast(data.error, "error"); }
  } catch (e) { toast("Network error", "error"); }
}

/* ── Helpers ───────────────────────────────────────────────────────── */
function driveIn(slotId) {
  const el = document.getElementById(`slot-${slotId}`);
  if (el) { el.classList.add("drive-in", "flash"); setTimeout(() => el.classList.remove("drive-in", "flash"), 800); }
}

function animateVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  const old = parseInt(el.textContent, 10) || 0;
  if (old !== val) { el.classList.add("count-pop"); setTimeout(() => el.classList.remove("count-pop"), 450); }
  el.textContent = val;
}

function toast(msg, type) {
  const el = document.getElementById("status-toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove("show"), 2800);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatTime(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
