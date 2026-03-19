/* ═══════════════════════════════════════════════════════════════════
   charts.js – Chart.js config (light theme, blue palette)
   ═══════════════════════════════════════════════════════════════════ */

let hourlyChart = null;
let dailyChart  = null;

const CHART_FONT = "'Inter', sans-serif";
const GRID_COLOR = "rgba(0,0,0,.07)";
const BLUE       = "#3b82f6";
const BLUE_DARK  = "#1d4ed8";
const BLUE_PALE  = "rgba(59,130,246,.15)";

Chart.defaults.color       = "#6b7280";
Chart.defaults.font.family = CHART_FONT;
Chart.defaults.font.size   = 11;
Chart.defaults.plugins.legend.display = false;

/* ── Hourly Usage (bar) ──────────────────────────────────────────── */
function renderHourlyChart(hourlyData) {
  const ctx = document.getElementById("chart-hourly");
  if (!ctx) return;

  const labels = Array.from({ length: 24 }, (_, i) => {
    const h = i % 12 || 12;
    const ampm = i < 12 ? "AM" : "PM";
    return `${h} ${ampm}`;
  });

  const config = {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: hourlyData,
        backgroundColor: BLUE,
        borderColor: BLUE_DARK,
        borderWidth: 1,
        borderRadius: 4,
        hoverBackgroundColor: BLUE_DARK,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 800, easing: "easeOutQuart" },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 9 } } },
        y: { grid: { color: GRID_COLOR }, beginAtZero: true },
      },
      plugins: {
        tooltip: {
          backgroundColor: "#1e293b", borderColor: BLUE, borderWidth: 1,
          cornerRadius: 6, padding: 8,
          titleFont: { weight: 700 },
        },
      },
    },
  };

  if (hourlyChart) {
    hourlyChart.data.datasets[0].data = hourlyData;
    hourlyChart.update("active");
  } else {
    hourlyChart = new Chart(ctx, config);
  }
}

/* ── Daily Occupancy (line) ──────────────────────────────────────── */
function renderDailyChart(dailyData) {
  const ctx = document.getElementById("chart-daily");
  if (!ctx) return;

  const labels = dailyData.map(d => {
    const dt = new Date(d.date);
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  });
  const values = dailyData.map(d => d.avg_occupancy_pct);

  const fill = ctx.getContext("2d");
  const grad = fill.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, "rgba(59,130,246,0.25)");
  grad.addColorStop(1, "rgba(59,130,246,0.02)");

  const config = {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: BLUE,
        borderWidth: 2.5,
        pointRadius: 5,
        pointBackgroundColor: BLUE,
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        fill: true,
        backgroundColor: grad,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 800, easing: "easeOutQuart" },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: GRID_COLOR }, beginAtZero: true, max: 100,
          ticks: { callback: v => v + "%" },
        },
      },
      plugins: {
        tooltip: {
          backgroundColor: "#1e293b", borderColor: BLUE, borderWidth: 1,
          cornerRadius: 6, padding: 8,
          callbacks: { label: ctx => ctx.parsed.y + "% occupancy" },
        },
      },
    },
  };

  if (dailyChart) {
    dailyChart.data.labels = labels;
    dailyChart.data.datasets[0].data = values;
    dailyChart.update("active");
  } else {
    dailyChart = new Chart(ctx, config);
  }
}
