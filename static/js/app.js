/* ═══════════════════════════════════════════════════════════════════
   app.js – Dashboard logic with 2D car animations
   ═══════════════════════════════════════════════════════════════════ */

let allSlots     = [];
let currentFloor = 1;

/* ── Top-down car SVG (red car) ───────────────────────────────────── */
const CAR_SVG = `<svg class="car-svg" viewBox="0 0 48 80" xmlns="http://www.w3.org/2000/svg">
  <!-- body -->
  <rect x="6" y="12" width="36" height="56" rx="10" fill="#dc2626"/>
  <!-- roof / cabin -->
  <rect x="10" y="24" width="28" height="22" rx="6" fill="#1e293b" opacity=".7"/>
  <!-- windshield front -->
  <rect x="12" y="16" width="24" height="10" rx="4" fill="#93c5fd" opacity=".6"/>
  <!-- windshield rear -->
  <rect x="12" y="54" width="24" height="8" rx="4" fill="#93c5fd" opacity=".5"/>
  <!-- headlights -->
  <circle cx="12" cy="14" r="3" fill="#fbbf24"/>
  <circle cx="36" cy="14" r="3" fill="#fbbf24"/>
  <!-- tail lights -->
  <circle cx="12" cy="66" r="2.5" fill="#f87171"/>
  <circle cx="36" cy="66" r="2.5" fill="#f87171"/>
  <!-- wheels -->
  <rect x="3" y="22" width="6" height="10" rx="3" fill="#1f2937"/>
  <rect x="39" y="22" width="6" height="10" rx="3" fill="#1f2937"/>
  <rect x="3" y="50" width="6" height="10" rx="3" fill="#1f2937"/>
  <rect x="39" y="50" width="6" height="10" rx="3" fill="#1f2937"/>
</svg>`;

/* ── Bootstrap ────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  refreshAll();
});

async function refreshAll() {
  await Promise.all([loadSlots(), loadAnalytics()]);
}

/* ── Load Slots ───────────────────────────────────────────────────── */
async function loadSlots() {
  try {
    const res = await fetch("/api/slots");
    allSlots = await res.json();
    renderGrid();
  } catch (e) {
    console.error("Failed to load slots", e);
  }
}

/* ── Load Analytics ───────────────────────────────────────────────── */
async function loadAnalytics() {
  try {
    const res  = await fetch("/api/analytics");
    const data = await res.json();

    animateValue("metric-total", data.total_slots);
    animateValue("metric-occupied", data.occupied);
    document.getElementById("metric-available-pct").textContent = data.available_pct + "%";
    animateValue("metric-prediction", data.predicted_available_10min);
    document.getElementById("metric-peak").textContent  = data.peak_hour;
    document.getElementById("metric-avg").textContent    = data.avg_occupancy_rate + "%";

    renderHourlyChart(data.hourly_usage);
    renderDailyChart(data.daily_occupancy);
  } catch (e) {
    console.error("Failed to load analytics", e);
  }
}

/* ── Render Grid ──────────────────────────────────────────────────── */
function renderGrid() {
  const floorSlots = allSlots.filter(s => s.floor === currentFloor);

  // Distribute across 3 rows of ~8-9 slots each
  const rows = [
    floorSlots.slice(0, 5),
    floorSlots.slice(5, 10),
    floorSlots.slice(10, 15),
    floorSlots.slice(15, 20),
    floorSlots.slice(20, 25),
  ];

  // We have 3 lot-rows for each section of 5 slots
  const rowEls = [
    document.getElementById("lot-row-1"),
    document.getElementById("lot-row-2"),
    document.getElementById("lot-row-3"),
  ];

  // On floor 1: 25 slots → rows of 5 (row1=0-4, row2=5-9, row3=10-14)
  // If > 15 slots, more go into row 3 etc.
  const slotsForRow = [
    floorSlots.slice(0, Math.min(5, floorSlots.length)),
    floorSlots.slice(5, Math.min(13, floorSlots.length)),
    floorSlots.slice(13, floorSlots.length),
  ];

  rowEls.forEach((rowEl, i) => {
    rowEl.innerHTML = "";
    (slotsForRow[i] || []).forEach(slot => {
      const el = document.createElement("div");
      el.className = `slot ${slot.status}`;
      el.id = `slot-${slot.id}`;

      if (slot.status === "occupied") {
        el.innerHTML = CAR_SVG + `<span class="slot-label">OCCUPIED</span>`;
      } else {
        el.innerHTML = `<span class="slot-label">FREE</span>`;
      }
      rowEl.appendChild(el);
    });
  });
}

/* ── Floor tabs ───────────────────────────────────────────────────── */
function switchFloor(floor) {
  currentFloor = floor;
  document.querySelectorAll(".floor-tab").forEach(t => {
    t.classList.toggle("active", Number(t.dataset.floor) === floor);
  });
  renderGrid();
}

/* ── Car Enter ────────────────────────────────────────────────────── */
async function carEnter() {
  try {
    const res  = await fetch("/api/enter", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      toast(`🚗 Car entered Slot ${data.slot_id} (Floor ${data.floor})`, "success");
      await refreshAll();
      driveInAnimation(data.slot_id);
    } else {
      toast(data.error || "Parking lot is full!", "error");
    }
  } catch (e) {
    toast("Network error", "error");
  }
}

/* ── Car Exit ─────────────────────────────────────────────────────── */
async function carExit() {
  try {
    // Find the first occupied slot to animate before exit
    const occupiedSlotEl = document.querySelector(".slot.occupied");
    const exitSlotId = occupiedSlotEl ? occupiedSlotEl.id.replace("slot-", "") : null;

    if (exitSlotId && occupiedSlotEl) {
      occupiedSlotEl.classList.add("drive-out");
      await sleep(500);
    }

    const res  = await fetch("/api/exit", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      toast(`🚙 Car exited Slot ${data.slot_id} (${data.duration_min} min)`, "success");
      await refreshAll();
    } else {
      toast(data.error || "No cars to exit!", "error");
    }
  } catch (e) {
    toast("Network error", "error");
  }
}

/* ── Drive-in animation ──────────────────────────────────────────── */
function driveInAnimation(slotId) {
  const el = document.getElementById(`slot-${slotId}`);
  if (el) {
    el.classList.add("drive-in", "flash");
    setTimeout(() => el.classList.remove("drive-in", "flash"), 800);
  }
}

/* ── Animated value update ────────────────────────────────────────── */
function animateValue(elId, newValue) {
  const el = document.getElementById(elId);
  if (!el) return;
  const old = parseInt(el.textContent, 10) || 0;
  if (old !== newValue) {
    el.classList.add("count-pop");
    setTimeout(() => el.classList.remove("count-pop"), 450);
  }
  el.textContent = newValue;
}

/* ── Toast helper ─────────────────────────────────────────────────── */
function toast(msg, type = "success") {
  const el = document.getElementById("status-toast");
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => { el.classList.remove("show"); }, 2800);
}

/* ── Sleep helper ─────────────────────────────────────────────────── */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
