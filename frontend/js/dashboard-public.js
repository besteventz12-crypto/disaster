feather.replace();

const API_BASE_URL = localStorage.getItem("crisisMitraApiBase") || "http://localhost:5000";
const ADMIN_TOKEN_KEY = "crisisMitraAdminToken";

const STORAGE_KEYS = {
  markers: "sosMarkers",
  offlineQueue: "sosOfflineQueue",
  emergencyContacts: "emergencyContacts",
  resolvedDate: "resolvedDate",
  resolvedCount: "resolvedTodayCount",
  warnings: "adminWarnings",
};

const DEFAULT_WARNING = "Cyclone Warning: Immediate evacuation ordered for coastal Sector 7 and 9.";
let warningsCache = readJson(STORAGE_KEYS.warnings, [DEFAULT_WARNING]);
let sosAlertsCache = [];
let dashboardMap = null;
let incidentMarkerLayer = null;
let customMarkerLayer = null;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    return fallback;
  }
}

function notify(message, type = "info") {
  if (typeof window.showNotification === "function") {
    window.showNotification(message, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

function setupAuthNav() {
  const adminLoginLink = document.getElementById("adminLoginLink");
  const mobileAdminLoginLink = document.getElementById("mobileAdminLoginLink");
  const logoutBtn = document.getElementById("logoutBtn");
  const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");
  const mobileInlineLogoutBtn = document.getElementById("mobileInlineLogoutBtn");

  const hasAdminToken = Boolean(localStorage.getItem(ADMIN_TOKEN_KEY));

  if (adminLoginLink) {
    adminLoginLink.classList.toggle("hidden", hasAdminToken);
  }
  if (mobileAdminLoginLink) {
    mobileAdminLoginLink.classList.toggle("hidden", hasAdminToken);
  }

  [logoutBtn, mobileLogoutBtn, mobileInlineLogoutBtn].forEach((btn) => {
    if (!btn) return;
    btn.classList.toggle("hidden", !hasAdminToken);
    if (btn.id === "mobileInlineLogoutBtn") {
      btn.classList.toggle("inline-flex", hasAdminToken);
    }

    if (btn.dataset.logoutBound === "1") return;
    btn.dataset.logoutBound = "1";
    btn.addEventListener("click", () => {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      localStorage.removeItem("crisisMitraUser");
      notify("Logged out successfully", "success");
      setupAuthNav();
      window.location.href = "./index.html";
    });
  });
}

function hideAdminOnlyBlocks() {
  document.querySelectorAll(".admin-only-nav, .admin-only-section").forEach((el) => {
    el.classList.add("hidden");
  });
}

function ensureDailyResolvedCounter() {
  const today = new Date().toISOString().slice(0, 10);
  const currentDate = localStorage.getItem(STORAGE_KEYS.resolvedDate);
  if (currentDate !== today) {
    localStorage.setItem(STORAGE_KEYS.resolvedDate, today);
    localStorage.setItem(STORAGE_KEYS.resolvedCount, "0");
  }
}

function formatTimeAgo(value) {
  if (!value) return "Just now";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Just now";
  const diffSec = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCoordinatesFromAlert(item) {
  const directLat = normalizeNumber(item?.latitude ?? item?.lat);
  const directLng = normalizeNumber(item?.longitude ?? item?.lng);
  if (directLat !== null && directLng !== null && Math.abs(directLat) <= 90 && Math.abs(directLng) <= 180) {
    return { lat: directLat, lng: directLng };
  }

  const location = String(item?.location || "");
  const match = location.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const lat = normalizeNumber(match[1]);
  const lng = normalizeNumber(match[2]);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  return { lat, lng };
}

function renderStats() {
  ensureDailyResolvedCounter();
  const queue = readJson(STORAGE_KEYS.offlineQueue, []);
  const contacts = readJson(STORAGE_KEYS.emergencyContacts, []);
  const resolvedToday = Number(localStorage.getItem(STORAGE_KEYS.resolvedCount) || "0");

  const activeAlertsEl = document.getElementById("activeAlertsCount");
  const respondersEl = document.getElementById("respondersCount");
  const resolvedEl = document.getElementById("resolvedTodayCount");

  if (activeAlertsEl) activeAlertsEl.textContent = String((Array.isArray(sosAlertsCache) ? sosAlertsCache.length : 0) + queue.length);
  if (respondersEl) respondersEl.textContent = String(contacts.length);
  if (resolvedEl) resolvedEl.textContent = String(resolvedToday);
}

async function fetchSosAlerts() {
  try {
    const response = await fetch(`${API_BASE_URL}/sos-alerts`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    sosAlertsCache = Array.isArray(payload?.items) ? payload.items : [];
  } catch (err) {
    sosAlertsCache = [];
    notify("Unable to load SOS incidents", "error");
  }
}

function renderCommunityFeed() {
  const container = document.getElementById("communityFeed");
  if (!container) return;

  const alerts = (Array.isArray(sosAlertsCache) ? sosAlertsCache : []).slice(0, 12);
  if (!alerts.length) {
    container.innerHTML = `
      <div class="p-4 bg-white/5 rounded-xl border-l-2 border-blue-500">
        <p class="text-sm font-bold mb-1">No incidents yet</p>
        <p class="text-gray-400 text-sm">New SOS submissions will appear here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = alerts
    .map((item) => {
      const alertId = item?._id || "";
      const href = alertId ? `./sos-alert.html?id=${encodeURIComponent(alertId)}` : "#";
      const name = item?.name || "Anonymous";
      const emergencyType = item?.type || "unknown";
      const location = item?.location || "Unknown location";
      const details = item?.details || "Incident reported";
      const time = formatTimeAgo(item?.created_at || item?.timestamp);
      return `
        <a href="${href}" class="block p-4 bg-white/5 hover:bg-white/10 rounded-xl border-l-2 border-red-500 transition-colors">
          <p class="text-sm font-bold mb-1">${name} - ${emergencyType} - ${time}</p>
          <p class="text-gray-300 text-sm">${location}</p>
          <p class="text-gray-400 text-sm mt-1">${details}</p>
        </a>
      `;
    })
    .join("");
}

function renderIncidentMarkers() {
  if (!dashboardMap || !incidentMarkerLayer || typeof L === "undefined") return;

  incidentMarkerLayer.clearLayers();
  const points = [];
  const alerts = Array.isArray(sosAlertsCache) ? sosAlertsCache : [];

  alerts.forEach((item) => {
    const coords = getCoordinatesFromAlert(item);
    if (!coords) return;

    points.push([coords.lat, coords.lng]);
    const alertId = item?._id ? `./sos-alert.html?id=${encodeURIComponent(item._id)}` : "";
    const popupParts = [
      `<strong>${escapeHtml(item?.name || "Anonymous")}</strong>`,
      `<div>Type: ${escapeHtml(item?.type || "unknown")}</div>`,
      `<div>Location: ${escapeHtml(item?.location || "Unknown")}</div>`,
      `<div>${escapeHtml(item?.details || "Incident reported")}</div>`,
    ];
    if (alertId) {
      popupParts.push(`<div style="margin-top:6px;"><a href="${alertId}">Open details</a></div>`);
    }

    L.marker([coords.lat, coords.lng])
      .addTo(incidentMarkerLayer)
      .bindPopup(popupParts.join(""));
  });

  if (points.length) {
    dashboardMap.fitBounds(points, { padding: [24, 24], maxZoom: 14 });
  }
}

function renderCustomMarkers() {
  if (!customMarkerLayer || typeof L === "undefined") return;

  customMarkerLayer.clearLayers();
  const sosMarkers = readJson(STORAGE_KEYS.markers, []);
  sosMarkers.forEach((marker) => {
    if (!Number.isFinite(Number(marker?.lat)) || !Number.isFinite(Number(marker?.lng))) return;
    L.marker([Number(marker.lat), Number(marker.lng)])
      .addTo(customMarkerLayer)
      .bindPopup(`<b>${escapeHtml(marker.title || "SOS Alert")}</b><br>${escapeHtml(marker.description || "Incident reported")}`);
  });
}

function normalizeWarnings(warnings) {
  const list = Array.isArray(warnings) ? warnings : [];
  const cleaned = list
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return cleaned.length ? cleaned : [DEFAULT_WARNING];
}

async function refreshWarnings() {
  try {
    const response = await fetch(`${API_BASE_URL}/warnings`);
    if (!response.ok) {
      throw new Error(`Warning API request failed: ${response.status}`);
    }
    const payload = await response.json();
    warningsCache = normalizeWarnings(payload?.warnings || []);
    localStorage.setItem(STORAGE_KEYS.warnings, JSON.stringify(warningsCache));
  } catch (err) {
    warningsCache = normalizeWarnings(readJson(STORAGE_KEYS.warnings, [DEFAULT_WARNING]));
    localStorage.setItem(STORAGE_KEYS.warnings, JSON.stringify(warningsCache));
    notify("Warning API unavailable. Using local backup data.", "error");
  }
}

function renderWarningTicker() {
  const warningTrack = document.getElementById("warningTrack");
  if (!warningTrack) return;

  const warnings = normalizeWarnings(warningsCache);
  const warningMarkup = warnings.map((warning, index) => {
    const separator = index < warnings.length - 1
      ? '<span class="alert-separator" aria-hidden="true">⚠</span>'
      : "";
    return `<span class="alert-item">${escapeHtml(warning)}</span>${separator}`;
  }).join("");

  if (warnings.length <= 1) {
    warningTrack.classList.add("static");
    warningTrack.innerHTML = warningMarkup;
    return;
  }

  warningTrack.classList.remove("static");
  warningTrack.innerHTML = `${warningMarkup}<span class="alert-separator" aria-hidden="true">⚠</span>${warningMarkup}`;
}

function setupMapAndMarkers() {
  const mapRoot = document.getElementById("map");
  if (!mapRoot || typeof L === "undefined") return;

  dashboardMap = L.map("map").setView([20.5937, 78.9629], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(dashboardMap);

  incidentMarkerLayer = L.layerGroup().addTo(dashboardMap);
  customMarkerLayer = L.layerGroup().addTo(dashboardMap);
  renderIncidentMarkers();
  renderCustomMarkers();

  dashboardMap.on("click", (e) => {
    const title = prompt("Enter SOS Title (e.g. 'Flood Help Needed')");
    const description = prompt("Enter short description (e.g. '3 people stranded near river')");
    if (!title || !description) return;

    const newMarker = {
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      title,
      description,
      timestamp: new Date().toISOString(),
    };

    const nextMarkers = readJson(STORAGE_KEYS.markers, []);
    nextMarkers.push(newMarker);
    localStorage.setItem(STORAGE_KEYS.markers, JSON.stringify(nextMarkers));
    renderCustomMarkers();
    renderStats();
    renderCommunityFeed();
  });

  const clearBtn = document.getElementById("clearMarkers");
  clearBtn?.addEventListener("click", () => {
    if (!confirm("Are you sure you want to clear all SOS markers?")) return;
    localStorage.removeItem(STORAGE_KEYS.markers);
    renderCustomMarkers();
    notify("Custom markers cleared", "success");
  });
}

function setupStorageSync() {
  window.addEventListener("storage", (e) => {
    if (e.key === ADMIN_TOKEN_KEY) {
      setupAuthNav();
    }
    if ([STORAGE_KEYS.markers, STORAGE_KEYS.offlineQueue, STORAGE_KEYS.emergencyContacts, STORAGE_KEYS.resolvedCount].includes(e.key)) {
      renderStats();
      renderCommunityFeed();
      if (e.key === STORAGE_KEYS.markers) {
        renderCustomMarkers();
      }
    }
    if (e.key === STORAGE_KEYS.warnings) {
      warningsCache = normalizeWarnings(readJson(STORAGE_KEYS.warnings, [DEFAULT_WARNING]));
      renderWarningTicker();
    }
  });
}

async function initPublicDashboard() {
  hideAdminOnlyBlocks();
  setupAuthNav();
  await fetchSosAlerts();
  await refreshWarnings();
  renderWarningTicker();
  renderStats();
  renderCommunityFeed();
  setupMapAndMarkers();
  renderIncidentMarkers();
  setupStorageSync();
}

initPublicDashboard();
