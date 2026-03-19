/* ═══════════════════════════════════════════════════════════════════
   user.js – User page: click-to-book slots, floor stats, animations
   ═══════════════════════════════════════════════════════════════════ */

let allSlots     = [];
let floorStats   = {};
let currentFloor = 1;

/* ── Top-down red car SVG ─────────────────────────────────────────── */
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
  await Promise.all([loadSlots(), loadFloorStats()]);
}

/* ── Load Slots ───────────────────────────────────────────────────── */
async function loadSlots() {
  try {
    const res = await fetch("/api/slots");
    allSlots = await res.json();
    renderGrid();
  } catch (e) { console.error("Failed to load slots", e); }
}

/* ── Load Floor Stats ─────────────────────────────────────────────── */
async function loadFloorStats() {
  try {
    const res = await fetch("/api/floor_stats");
    floorStats = await res.json();
    updateFloorStatsUI();
  } catch (e) { console.error("Failed to load floor stats", e); }
}

function updateFloorStatsUI() {
  const f = String(currentFloor);
  const s = floorStats[f] || { total: 0, occupied: 0, available: 0 };
  animateVal("fs-total-val", s.total);
  animateVal("fs-occupied-val", s.occupied);
  animateVal("fs-available-val", s.available);
}

/* ── Render Grid (realistic: top row + driveway + bottom row) ───── */
function renderGrid() {
  const floorSlots = allSlots.filter(s => s.floor === currentFloor);
  const half = Math.ceil(floorSlots.length / 2);
  const topSlots = floorSlots.slice(0, half);
  const bottomSlots = floorSlots.slice(half);

  renderRow("slot-row-top", topSlots, "top");
  renderRow("slot-row-bottom", bottomSlots, "bottom");
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
    el.dataset.slotId = slot.id;

    if (slot.status === "occupied") {
      el.innerHTML = carSvg + `<span class="slot-label">OCCUPIED</span>`;
    } else {
      el.innerHTML = `<span class="slot-id-num">${slot.id}</span><span class="slot-label">FREE</span>`;
      el.addEventListener("click", () => bookSlot(slot.id));
      el.classList.add("clickable");
    }
    container.appendChild(el);
  });
}

/* ── Switch Floor ─────────────────────────────────────────────────── */
function switchFloor(floor) {
  currentFloor = floor;
  document.querySelectorAll(".floor-tab").forEach(t =>
    t.classList.toggle("active", Number(t.dataset.floor) === floor)
  );
  renderGrid();
}

/* ── Book a specific slot ─────────────────────────────────────────── */
async function bookSlot(slotId) {
  try {
    const res = await fetch(`/api/book/${slotId}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      toast(`🚗 Booked Slot ${data.slot_id} (Floor ${data.floor})`, "success");
      await refreshAll();
      driveIn(slotId);
    } else {
      toast(data.error || "Slot not available!", "error");
    }
  } catch (e) { toast("Network error", "error"); }
}

/* ── Animations ───────────────────────────────────────────────────── */
function driveIn(slotId) {
  const el = document.getElementById(`slot-${slotId}`);
  if (el) {
    el.classList.add("drive-in", "flash");
    setTimeout(() => el.classList.remove("drive-in", "flash"), 800);
  }
}

function animateVal(id, newVal) {
  const el = document.getElementById(id);
  if (!el) return;
  const old = parseInt(el.textContent, 10) || 0;
  if (old !== newVal) {
    el.classList.add("count-pop");
    setTimeout(() => el.classList.remove("count-pop"), 450);
  }
  el.textContent = newVal;
}

/* ── Toast ─────────────────────────────────────────────────────────── */
function toast(msg, type = "success") {
  const el = document.getElementById("status-toast");
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove("show"), 2800);
}
