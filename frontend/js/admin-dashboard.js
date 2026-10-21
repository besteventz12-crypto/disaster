feather.replace();

const API_BASE_URL = localStorage.getItem("crisisMitraApiBase") || "https://backend-production-6882.up.railway.app";
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
let missingReportsCache = [];
let isAdminSession = false;
let sosAlertsCache = [];
let dashboardMap = null;
let incidentMarkerLayer = null;
let customMarkerLayer = null;

function formatScoreOutOfTen(value) {
  const normalized = Math.max(0, Math.min(1, Number(value) || 0));
  return `${(normalized * 10).toFixed(1)} out of 10`;
}

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function getAdminAuthHeaders(extraHeaders = {}) {
  const token = getAdminToken();
  if (!token) return null;
  return {
    ...extraHeaders,
    Authorization: `Bearer ${token}`,
  };
}

function setupAuthNav(isAdmin = null) {
  const adminLoginLink = document.getElementById("adminLoginLink");
  const mobileAdminLoginLink = document.getElementById("mobileAdminLoginLink");
  const logoutBtn = document.getElementById("logoutBtn");
  const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");
  const mobileInlineLogoutBtn = document.getElementById("mobileInlineLogoutBtn");

  const hasAdmin = isAdmin === null ? Boolean(getAdminToken()) : Boolean(isAdmin);

  if (adminLoginLink) {
    adminLoginLink.classList.toggle("hidden", hasAdmin);
  }
  if (mobileAdminLoginLink) {
    mobileAdminLoginLink.classList.toggle("hidden", hasAdmin);
  }

  [logoutBtn, mobileLogoutBtn, mobileInlineLogoutBtn].forEach((btn) => {
    if (!btn) return;
    btn.classList.toggle("hidden", !hasAdmin);
    if (btn.id === "mobileInlineLogoutBtn") {
      btn.classList.toggle("inline-flex", hasAdmin);
    }

    if (btn.dataset.logoutBound === "1") return;
    btn.dataset.logoutBound = "1";
    btn.addEventListener("click", () => {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      localStorage.removeItem("crisisMitraUser");
      setupAuthNav(false);
      setAdminActionState(false);
      notify("Logged out successfully", "success");
      window.location.href = "./index.html";
    });
  });
}

function setAdminActionState(isAdmin) {
  isAdminSession = !!isAdmin;
  setupAuthNav(isAdminSession);
  document.querySelectorAll(".admin-only-nav").forEach((el) => {
    el.classList.toggle("hidden", !isAdminSession);
    el.style.setProperty("display", isAdminSession ? "inline-flex" : "none", "important");
  });
  document.querySelectorAll(".admin-only-section").forEach((el) => {
    el.classList.toggle("hidden", !isAdminSession);
    el.style.setProperty("display", isAdminSession ? "block" : "none", "important");
  });
}

function handleUnauthorized(message = "Admin login required for this action.") {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem("crisisMitraUser");
  setAdminActionState(false);
  notify(message, "error");
}

async function ensureAdminSession() {
  const authHeaders = getAdminAuthHeaders();
  if (!authHeaders) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/admin/session`, {
      headers: authHeaders,
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        handleUnauthorized("Admin session expired. Please sign in again.");
      }
      return false;
    }
    return true;
  } catch (err) {
    notify("Unable to verify admin session", "error");
    return false;
  }
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    return fallback;
  }
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMedicalInfo(medicalInfo) {
  const info = medicalInfo || {};
  const injury = info.injury || "N/A";
  const conditions = Array.isArray(info.conditions) && info.conditions.length
    ? info.conditions.join(", ")
    : "None";
  const allergies = info.allergies || "None";
  return { injury, conditions, allergies };
}

function renderEvidenceMedia(mediaList) {
  const urls = Array.isArray(mediaList) ? mediaList.filter(Boolean) : [];
  if (!urls.length) {
    return '<p class="text-gray-400 text-sm">No media attached</p>';
  }

  return `
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      ${urls
        .map((url, index) => {
          const safeUrl = escapeHtml(url);
          const lower = String(url).toLowerCase();
          const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(lower);
          if (isImage) {
            return `
              <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="block rounded-lg overflow-hidden border border-white/10 bg-black/30">
                <img src="${safeUrl}" alt="evidence-${index + 1}" class="w-full h-28 object-cover" />
              </a>
            `;
          }
          return `
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="p-3 rounded-lg border border-white/10 bg-black/30 text-xs text-blue-300 hover:text-blue-200 break-all">
              Open Media ${index + 1}
            </a>
          `;
        })
        .join("")}
    </div>
  `;
}

async function fetchSosAlerts() {
  const authHeaders = getAdminAuthHeaders();
  if (!authHeaders) {
    sosAlertsCache = [];
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/sos-alerts/admin`, {
      headers: authHeaders,
    });
    if (response.status === 401 || response.status === 403) {
      handleUnauthorized("Admin session expired. Please sign in again.");
      sosAlertsCache = [];
      return;
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    sosAlertsCache = Array.isArray(payload?.items) ? payload.items : [];
  } catch (err) {
    sosAlertsCache = [];
    notify("Unable to load SOS alerts", "error");
  }
}

function renderCommunityFeed() {
  const container = document.getElementById("communityFeed");
  if (!container) return;

  const alerts = Array.isArray(sosAlertsCache) ? sosAlertsCache.slice(0, 25) : [];
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
      const peopleCount = item?.peopleCount || "N/A";
      const details = item?.details || "No additional details";
      const med = formatMedicalInfo(item?.medicalInfo || {});
      const evidenceMarkup = renderEvidenceMedia(item?.evidenceMedia || []);
      const time = formatTimeAgo(item?.created_at || item?.timestamp);
      return `
        <a href="${href}" class="block p-4 bg-white/5 hover:bg-white/10 rounded-xl border-l-2 border-red-500 transition-colors">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-bold mb-1">${escapeHtml(name)} - ${escapeHtml(emergencyType)} - ${escapeHtml(time)}</p>
              <p class="text-gray-300 text-sm">${escapeHtml(location)}</p>
            </div>
            <span class="text-[11px] px-2 py-1 rounded bg-red-600/20 text-red-300">Open details</span>
          </div>
          <div class="mt-3 grid md:grid-cols-2 gap-3 text-sm">
            <div class="p-3 rounded-lg bg-black/30 border border-white/10">
              <p><strong>People Affected:</strong> ${escapeHtml(peopleCount)}</p>
              <p><strong>Injury:</strong> ${escapeHtml(med.injury)}</p>
            </div>
            <div class="p-3 rounded-lg bg-black/30 border border-white/10">
              <p><strong>Conditions:</strong> ${escapeHtml(med.conditions)}</p>
              <p><strong>Allergies:</strong> ${escapeHtml(med.allergies)}</p>
            </div>
            <div class="md:col-span-2 p-3 rounded-lg bg-black/30 border border-white/10">
              <p class="text-xs uppercase tracking-wide text-gray-400 mb-1">Additional Details</p>
              <p class="text-gray-200">${escapeHtml(details)}</p>
            </div>
            <div class="md:col-span-2 p-3 rounded-lg bg-black/30 border border-white/10">
              <p class="text-xs uppercase tracking-wide text-gray-400 mb-2">Evidence Media</p>
              ${evidenceMarkup}
            </div>
          </div>
        </a>
      `;
    })
    .join("");
}

function getWarnings() {
  if (!Array.isArray(warningsCache) || !warningsCache.length) {
    return [DEFAULT_WARNING];
  }
  return warningsCache;
}

function normalizeWarnings(warnings) {
  const list = Array.isArray(warnings) ? warnings : [];
  const cleaned = list
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return cleaned.length ? cleaned : [DEFAULT_WARNING];
}

async function fetchWarningsFromApi() {
  const response = await fetch(`${API_BASE_URL}/warnings`);
  if (!response.ok) {
    throw new Error(`Failed to fetch warnings: ${response.status}`);
  }
  const payload = await response.json();
  const nextWarnings = normalizeWarnings(payload?.warnings || []);
  warningsCache = nextWarnings;
  localStorage.setItem(STORAGE_KEYS.warnings, JSON.stringify(nextWarnings));
  return nextWarnings;
}

async function saveWarnings(warnings) {
  const nextWarnings = normalizeWarnings(warnings);
  const authHeaders = getAdminAuthHeaders({
    "Content-Type": "application/json",
  });
  if (!authHeaders) {
    handleUnauthorized();
    throw new Error("Admin login required");
  }

  const response = await fetch(`${API_BASE_URL}/warnings`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({ warnings: nextWarnings }),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      handleUnauthorized("Admin session expired. Please sign in again.");
    }
    throw new Error(`Failed to save warnings: ${response.status}`);
  }
  const payload = await response.json();
  warningsCache = normalizeWarnings(payload?.warnings || nextWarnings);
  localStorage.setItem(STORAGE_KEYS.warnings, JSON.stringify(warningsCache));
  return warningsCache;
}

async function refreshWarnings() {
  try {
    await fetchWarningsFromApi();
  } catch (err) {
    warningsCache = normalizeWarnings(readJson(STORAGE_KEYS.warnings, [DEFAULT_WARNING]));
    localStorage.setItem(STORAGE_KEYS.warnings, JSON.stringify(warningsCache));
    notify("Warning API unavailable. Using local backup data.", "error");
  }
}

function renderWarningTicker() {
  const warningTrack = document.getElementById("warningTrack");
  if (!warningTrack) return;
  const warnings = getWarnings();
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

function renderWarningList() {
  const warningListEl = document.getElementById("warningList");
  if (!warningListEl) return;
  const warnings = getWarnings();
  warningListEl.innerHTML = warnings
    .map(
      (warning, index) => `
      <div class="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <p class="text-sm text-gray-200">${warning}</p>
        ${isAdminSession
          ? `<button data-warning-index="${index}" class="text-xs px-2 py-1 rounded bg-red-600/20 text-red-300 hover:bg-red-600/30">Remove</button>`
          : `<span class="text-xs px-2 py-1 rounded bg-white/10 text-gray-400">Admin only</span>`}
      </div>
    `
    )
    .join("");

  warningListEl.querySelectorAll("button[data-warning-index]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const warningsData = getWarnings();
      const index = Number(btn.getAttribute("data-warning-index"));
      if (Number.isNaN(index)) return;
      warningsData.splice(index, 1);
      if (!warningsData.length) {
        warningsData.push(DEFAULT_WARNING);
      }
      try {
        await saveWarnings(warningsData);
      } catch (err) {
        notify("Failed to remove warning", "error");
        return;
      }
      renderWarningTicker();
      renderWarningList();
      renderMasterDataSnapshot();
      notify("Warning removed", "success");
    });
  });
}

function renderMasterDataSnapshot() {
  const preview = document.getElementById("masterDataPreview");
  if (!preview) return;
  const snapshot = {
    warnings: getWarnings(),
    sosAlertsCount: Array.isArray(sosAlertsCache) ? sosAlertsCache.length : 0,
    sosMarkers: readJson(STORAGE_KEYS.markers, []),
    offlineQueue: readJson(STORAGE_KEYS.offlineQueue, []),
    emergencyContacts: readJson(STORAGE_KEYS.emergencyContacts, []),
    resolvedToday: Number(localStorage.getItem(STORAGE_KEYS.resolvedCount) || "0"),
    generatedAt: new Date().toISOString(),
  };
  preview.textContent = JSON.stringify(snapshot, null, 2);
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

  dashboardMap.on("click", function (e) {
    const title = prompt("Enter SOS Title (e.g. 'Flood Help Needed')");
    const description = prompt(
      "Enter short description (e.g. '3 people stranded near river')"
    );
    if (!title || !description) return;
    const newMarker = {
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      title,
      description,
      timestamp: new Date().toISOString(),
    };
    const storedMarkers = readJson(STORAGE_KEYS.markers, []);
    storedMarkers.push(newMarker);
    localStorage.setItem(STORAGE_KEYS.markers, JSON.stringify(storedMarkers));
    renderCustomMarkers();
    renderStats();
    renderCommunityFeed();
  });

  document.getElementById("clearMarkers")?.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all SOS markers?")) {
      localStorage.removeItem(STORAGE_KEYS.markers);
      renderCustomMarkers();
      notify("Custom markers cleared", "success");
    }
  });
}

function setupWarningControls() {
  const warningInput = document.getElementById("warningInput");
  const addWarningBtn = document.getElementById("addWarningBtn");
  const refreshMasterDataBtn = document.getElementById("refreshMasterData");

  addWarningBtn?.addEventListener("click", async () => {
    if (!warningInput) return;
    const value = warningInput.value.trim();
    if (!value) {
      notify("Enter a warning message first", "error");
      return;
    }
    const warnings = getWarnings();
    warnings.push(value);
    try {
      await saveWarnings(warnings);
    } catch (err) {
      notify("Failed to add warning", "error");
      return;
    }
    warningInput.value = "";
    renderWarningTicker();
    renderWarningList();
    renderMasterDataSnapshot();
    notify("Warning added to moving ticker", "success");
  });

  refreshMasterDataBtn?.addEventListener("click", async () => {
    await fetchSosAlerts();
    await refreshWarnings();
    renderStats();
    renderCommunityFeed();
    renderIncidentMarkers();
    renderWarningTicker();
    renderWarningList();
    renderMasterDataSnapshot();
    notify("Master data refreshed", "success");
  });
}

// Translations
const translations = {
  en: {
    sosBtn: "SOS",
    adminLogin: "Admin Login",
    responseDashboard: "Response Dashboard",
    activeAlerts: "Active Alerts",
    responders: "Responders",
    resolvedToday: "Resolved Today",
    mapTitle: "Interactive Incident Map",
    clearMarkers: "Clear All Markers",
  },
  hi: {
    sosBtn: "Ã Â¤ÂÃ Â¤Â¸Ã Â¤â€œÃ Â¤ÂÃ Â¤Â¸",
    adminLogin: "Admin Login",
    responseDashboard: "Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â°Ã Â¤Â¤Ã Â¤Â¿Ã Â¤â€¢Ã Â¥ÂÃ Â¤Â°Ã Â¤Â¿Ã Â¤Â¯Ã Â¤Â¾ Ã Â¤Â¡Ã Â¥Ë†Ã Â¤Â¶Ã Â¤Â¬Ã Â¥â€¹Ã Â¤Â°Ã Â¥ÂÃ Â¤Â¡",
    activeAlerts: "Ã Â¤Â¸Ã Â¤â€¢Ã Â¥ÂÃ Â¤Â°Ã Â¤Â¿Ã Â¤Â¯ Ã Â¤â€¦Ã Â¤Â²Ã Â¤Â°Ã Â¥ÂÃ Â¤Å¸",
    responders: "Ã Â¤â€°Ã Â¤Â¤Ã Â¥ÂÃ Â¤Â¤Ã Â¤Â°Ã Â¤Â¦Ã Â¤Â¾Ã Â¤Â¤Ã Â¤Â¾",
    resolvedToday: "Ã Â¤â€ Ã Â¤Å“ Ã Â¤Â¹Ã Â¤Â² Ã Â¤â€¢Ã Â¤Â¿Ã Â¤Â Ã Â¤â€”Ã Â¤Â",
    mapTitle: "Ã Â¤â€¡Ã Â¤â€šÃ Â¤Å¸Ã Â¤Â°Ã Â¤ÂÃ Â¤â€¢Ã Â¥ÂÃ Â¤Å¸Ã Â¤Â¿Ã Â¤Âµ Ã Â¤ËœÃ Â¤Å¸Ã Â¤Â¨Ã Â¤Â¾ Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â¨Ã Â¤Å¡Ã Â¤Â¿Ã Â¤Â¤Ã Â¥ÂÃ Â¤Â°",
    clearMarkers: "Ã Â¤Â¸Ã Â¤Â­Ã Â¥â‚¬ Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â°Ã Â¥ÂÃ Â¤â€¢Ã Â¤Â° Ã Â¤Â¹Ã Â¤Å¸Ã Â¤Â¾Ã Â¤ÂÃ Â¤â€š",
  },
  mr: {
    sosBtn: "Ã Â¤ÂÃ Â¤Â¸Ã Â¤â€œÃ Â¤ÂÃ Â¤Â¸",
    adminLogin: "Admin Login",
    responseDashboard: "Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â°Ã Â¤Â¤Ã Â¤Â¿Ã Â¤Â¸Ã Â¤Â¾Ã Â¤Â¦ Ã Â¤Â¡Ã Â¥â€¦Ã Â¤Â¶Ã Â¤Â¬Ã Â¥â€¹Ã Â¤Â°Ã Â¥ÂÃ Â¤Â¡",
    activeAlerts: "Ã Â¤Â¸Ã Â¤â€¢Ã Â¥ÂÃ Â¤Â°Ã Â¤Â¿Ã Â¤Â¯ Ã Â¤Å¡Ã Â¥â€¡Ã Â¤Â¤Ã Â¤Â¾Ã Â¤ÂµÃ Â¤Â£Ã Â¥â‚¬",
    responders: "Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â°Ã Â¤Â¤Ã Â¤Â¿Ã Â¤Â¸Ã Â¤Â¾Ã Â¤Â¦Ã Â¤â€¢Ã Â¤Â°Ã Â¥ÂÃ Â¤Â¤Ã Â¥â€¡",
    resolvedToday: "Ã Â¤â€ Ã Â¤Å“ Ã Â¤Â¨Ã Â¤Â¿Ã Â¤Â°Ã Â¤Â¾Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â£ Ã Â¤ÂÃ Â¤Â¾Ã Â¤Â²Ã Â¥â€¡Ã Â¤Â²Ã Â¥â€¡",
    mapTitle: "Ã Â¤ÂªÃ Â¤Â°Ã Â¤Â¸Ã Â¥ÂÃ Â¤ÂªÃ Â¤Â°Ã Â¤Â¸Ã Â¤â€šÃ Â¤ÂµÃ Â¤Â¾Ã Â¤Â¦Ã Â¥â‚¬ Ã Â¤ËœÃ Â¤Å¸Ã Â¤Â¨Ã Â¤Â¾ Ã Â¤Â¨Ã Â¤â€¢Ã Â¤Â¾Ã Â¤Â¶Ã Â¤Â¾",
    clearMarkers: "Ã Â¤Â¸Ã Â¤Â°Ã Â¥ÂÃ Â¤Âµ Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â°Ã Â¥ÂÃ Â¤â€¢Ã Â¤Â° Ã Â¤Â¸Ã Â¤Â¾Ã Â¤Â« Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â¾",
  },
};

function setLanguage(lang) {
  localStorage.setItem("crisisMitraLang", lang);

  // Update Buttons
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
  });

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (translations[lang] && translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
}

// Initialize
const savedLang = localStorage.getItem("crisisMitraLang") || "en";
setLanguage(savedLang);

document.querySelectorAll(".lang-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setLanguage(btn.getAttribute("data-lang"));
  });
});

window.addEventListener("storage", (e) => {
  if (e.key === ADMIN_TOKEN_KEY) {
    setupAuthNav();
  }
  if (e.key === "crisisMitraLang") {
    setLanguage(e.newValue);
  }
  if ([STORAGE_KEYS.markers, STORAGE_KEYS.offlineQueue, STORAGE_KEYS.emergencyContacts, STORAGE_KEYS.resolvedCount].includes(e.key)) {
    renderStats();
    renderMasterDataSnapshot();
    if (e.key === STORAGE_KEYS.markers) {
      renderCustomMarkers();
    }
  }
  if (e.key === STORAGE_KEYS.warnings) {
    renderWarningTicker();
    renderWarningList();
    renderMasterDataSnapshot();
  }
});

async function initDashboard() {
  setupMapAndMarkers();
  setupAuthNav();
  const isAdmin = await ensureAdminSession();
  setAdminActionState(isAdmin);
  if (isAdmin) {
    await fetchSosAlerts();
  } else {
    sosAlertsCache = [];
  }
  await refreshWarnings();
  renderStats();
  renderCommunityFeed();
  renderIncidentMarkers();
  renderWarningTicker();
  renderWarningList();
  renderMasterDataSnapshot();
  setupWarningControls();
  if (isAdmin) {
    setupMatchingControls();
    fetchAdminMatches();
    fetchMissingPersons();
  }
}

initDashboard();

function notify(message, type = "info") {
  if (typeof window.showNotification === "function") {
    window.showNotification(message, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function setupAdminControls() {
  const refreshBtn = document.getElementById("refreshAdminMetrics");
  const exportBtn = document.getElementById("exportIncidentData");
  const clearQueueBtn = document.getElementById("clearOfflineQueue");
  const healthBtn = document.getElementById("runSystemHealthCheck");
  const statusPill = document.getElementById("systemHealthStatus");

  refreshBtn?.addEventListener("click", () => {
    fetchSosAlerts().then(() => {
      renderStats();
      renderCommunityFeed();
      renderIncidentMarkers();
      notify("Dashboard metrics refreshed", "success");
    });
  });

  exportBtn?.addEventListener("click", () => {
    const incidents = readJson(STORAGE_KEYS.markers, []);
    downloadJson(`incident-export-${new Date().toISOString().slice(0, 10)}.json`, incidents);
    notify("Incident data exported", "success");
  });

  clearQueueBtn?.addEventListener("click", () => {
    if (!confirm("Clear all queued offline alerts?")) return;
    localStorage.setItem(STORAGE_KEYS.offlineQueue, JSON.stringify([]));
    renderStats();
    notify("Offline queue cleared", "success");
  });

  healthBtn?.addEventListener("click", async () => {
    if (!statusPill) return;
    statusPill.textContent = "System status: checking...";
    statusPill.className = "text-xs px-3 py-1 rounded-full bg-white/10 text-gray-300";
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (payload?.ok) {
        statusPill.textContent = "System status: healthy";
        statusPill.className = "text-xs px-3 py-1 rounded-full bg-green-600/20 text-green-300";
        notify("API health check passed", "success");
      } else {
        throw new Error("Unexpected health payload");
      }
    } catch (err) {
      statusPill.textContent = "System status: unhealthy";
      statusPill.className = "text-xs px-3 py-1 rounded-full bg-red-600/20 text-red-300";
      notify("API health check failed", "error");
    }
  });
}

setupAdminControls();

function renderAdminMatches(matches) {
  const container = document.getElementById("adminMatchResults");
  if (!container) return;

  if (!Array.isArray(matches) || !matches.length) {
    container.innerHTML = `
      <div class="p-4 bg-white/5 rounded-xl border border-white/10">
        <p class="text-sm font-bold mb-1">No matched cases yet</p>
        <p class="text-sm text-gray-400">Run match after reports are submitted from Missing Person / Found Person forms.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = matches
    .map((item) => {
      const score = formatScoreOutOfTen(item.score);
      const faceAvailable = Boolean(item?.ai?.faceAvailable);
      const faceScore = formatScoreOutOfTen(item?.ai?.faceSimilarity || 0);
      const missingName = item?.missing?.personName || "Unknown";
      const foundName = item?.found?.personName || "Unknown";
      const missingPhoto = item?.missing?.photoUrl || "";
      const foundPhoto = item?.found?.photoUrl || "";
      const missingContact = item?.missing?.contact || {};
      const foundContact = item?.found?.contact || {};
      return `
        <article class="p-4 bg-white/5 rounded-xl border border-green-500/30">
          <div class="flex items-center justify-between gap-4 mb-2">
            <h4 class="font-bold text-green-300">Match Found</h4>
            <span class="text-xs px-2 py-1 rounded bg-green-600/20 text-green-300">score ${score}</span>
          </div>
          <p class="text-xs text-gray-400 mb-2">${faceAvailable ? `AI Face score used: ${faceScore}` : "No clear face detected in one or both images. Rule-based score only."}</p>
          <p class="text-sm mb-2"><strong>Missing:</strong> ${missingName}</p>
          <p class="text-sm mb-2"><strong>Found/Suspected:</strong> ${foundName}</p>
          <div class="grid md:grid-cols-2 gap-3 mt-2 mb-3">
            <div class="p-2 rounded-lg bg-black/30 border border-white/10">
              ${missingPhoto ? `<img src="${missingPhoto}" alt="${missingName}" class="w-full h-40 object-cover rounded">` : `<div class="w-full h-40 flex items-center justify-center text-xs text-gray-400">Missing image unavailable</div>`}
            </div>
            <div class="p-2 rounded-lg bg-black/30 border border-white/10">
              ${foundPhoto ? `<img src="${foundPhoto}" alt="${foundName}" class="w-full h-40 object-cover rounded">` : `<div class="w-full h-40 flex items-center justify-center text-xs text-gray-400">Found image unavailable</div>`}
            </div>
          </div>
          <div class="grid md:grid-cols-2 gap-3 mt-3">
            <div class="p-3 rounded-lg bg-black/30 border border-white/10">
              <p class="text-xs uppercase tracking-wide text-gray-400 mb-1">Contact Missing Person Reporter</p>
              <p class="text-sm">${missingContact.name || "N/A"}</p>
              <p class="text-sm">${missingContact.phone || "N/A"}</p>
              <p class="text-xs text-gray-400">${missingContact.relation || ""}</p>
            </div>
            <div class="p-3 rounded-lg bg-black/30 border border-white/10">
              <p class="text-xs uppercase tracking-wide text-gray-400 mb-1">Contact Found Person Reporter</p>
              <p class="text-sm">${foundContact.name || "N/A"}</p>
              <p class="text-sm">${foundContact.phone || "N/A"}</p>
              <p class="text-xs text-gray-400">${foundContact.relation || ""}</p>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMatchBroadcast(match) {
  const banner = document.getElementById("matchFoundBroadcast");
  const titleEl = document.getElementById("broadcastTitle");
  const bodyEl = document.getElementById("broadcastBody");
  const scoreEl = document.getElementById("broadcastScore");
  if (!banner || !titleEl || !bodyEl || !scoreEl) return;

  if (!match) {
    banner.classList.add("hidden");
    return;
  }

  const score = formatScoreOutOfTen(match.score);
  const faceAvailable = Boolean(match?.ai?.faceAvailable);
  const faceScore = formatScoreOutOfTen(match?.ai?.faceSimilarity || 0);
  const missingName = match?.missing?.personName || "Unknown";
  const foundName = match?.found?.personName || "Unknown";
  const contactName = match?.found?.contact?.name || match?.missing?.contact?.name || "N/A";
  const contactPhone = match?.found?.contact?.phone || match?.missing?.contact?.phone || "N/A";

  titleEl.textContent = `Match Found: ${missingName} ↔ ${foundName}`;
  bodyEl.textContent = faceAvailable
    ? `Person found. Contact ${contactName} at ${contactPhone}. AI face score ${faceScore} was used in this match.`
    : `Person found. Contact ${contactName} at ${contactPhone}. No clear face detected, so rule-based scoring was used.`;
  scoreEl.textContent = `score ${score}`;
  banner.classList.remove("hidden");
}

function renderSelectedMissingPreview(record) {
  const container = document.getElementById("selectedMissingPreview");
  if (!container) return;

  if (!record) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  const photo = record.photoUrl
    ? `<img src="${record.photoUrl}" alt="${record.personName || "Missing person"}" class="w-24 h-24 rounded-lg object-cover border border-white/20" />`
    : `<div class="w-24 h-24 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs text-gray-400">No Image</div>`;

  container.innerHTML = `
    <div class="flex items-start gap-4">
      ${photo}
      <div class="text-sm">
        <p class="font-bold text-white mb-1">${record.personName || "Unknown"}</p>
        <p class="text-gray-300">Age: ${record.age ?? "N/A"} | Gender: ${record.gender || "N/A"}</p>
        <p class="text-gray-400 mt-1">Last Seen: ${record.lastSeenLocation || "N/A"}</p>
        <p class="text-gray-400">Contact: ${record?.contact?.name || "N/A"} (${record?.contact?.phone || "N/A"})</p>
      </div>
    </div>
  `;
  container.classList.remove("hidden");
}

function populateMissingPersonDropdown(items) {
  const select = document.getElementById("missingPersonSelect");
  if (!select) return;

  const records = Array.isArray(items) ? items : [];
  missingReportsCache = records;

  const hasRecords = records.length > 0;
  select.innerHTML = `
    <option value="" disabled selected hidden>${hasRecords ? "Select missing person" : "No missing persons available"}</option>
  `;
  records.forEach((item) => {
    const option = document.createElement("option");
    option.value = item._id;
    const name = item.personName || "Unknown";
    const loc = item.lastSeenLocation || "Unknown location";
    option.textContent = `${name} - ${loc}`;
    select.appendChild(option);
  });
}

async function fetchMissingPersons() {
  try {
    const response = await fetch(`${API_BASE_URL}/missing-persons`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    populateMissingPersonDropdown(payload?.items || []);
  } catch (err) {
    populateMissingPersonDropdown([]);
    notify("Unable to load missing person list", "error");
  }
}

async function fetchAdminMatches() {
  try {
    const response = await fetch(`${API_BASE_URL}/matches`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    renderAdminMatches(payload?.items || []);
  } catch (err) {
    renderAdminMatches([]);
    notify("Unable to load match data", "error");
  }
}

function setupMatchingControls() {
  const runMatchBtn = document.getElementById("runPersonMatch");
  const runSelectedBtn = document.getElementById("runSelectedPersonMatch");
  const missingPersonSelect = document.getElementById("missingPersonSelect");

  missingPersonSelect?.addEventListener("change", () => {
    const selectedId = missingPersonSelect.value;
    const selected = missingReportsCache.find((item) => item._id === selectedId);
    renderSelectedMissingPreview(selected || null);
  });

  runMatchBtn?.addEventListener("click", async () => {
    if (!isAdminSession) {
      notify("Only admin can run matching", "error");
      return;
    }
    try {
      const authHeaders = getAdminAuthHeaders({
        "Content-Type": "application/json",
      });
      if (!authHeaders) {
        handleUnauthorized();
        return;
      }

      runMatchBtn.disabled = true;
      runMatchBtn.textContent = "Running...";
      const response = await fetch(`${API_BASE_URL}/matches/run`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ threshold: 0.62 }),
      });
      if (response.status === 401 || response.status === 403) {
        handleUnauthorized("Admin session expired. Please sign in again.");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      renderAdminMatches(payload?.matches || []);
      renderMatchBroadcast((payload?.matches || [])[0] || null);
      notify(`Match run complete. ${payload?.count || 0} case(s) matched.`, "success");
    } catch (err) {
      notify("Failed to run matching", "error");
    } finally {
      runMatchBtn.disabled = false;
      runMatchBtn.textContent = "Run Match";
      fetchAdminMatches();
    }
  });

  runSelectedBtn?.addEventListener("click", async () => {
    if (!isAdminSession) {
      notify("Only admin can run matching", "error");
      return;
    }
    const selectedId = missingPersonSelect?.value || "";
    if (!selectedId) {
      notify("Select a missing person first", "error");
      return;
    }

    try {
      const authHeaders = getAdminAuthHeaders({
        "Content-Type": "application/json",
      });
      if (!authHeaders) {
        handleUnauthorized();
        return;
      }

      runSelectedBtn.disabled = true;
      runSelectedBtn.textContent = "Running...";
      const response = await fetch(`${API_BASE_URL}/matches/run/missing/${encodeURIComponent(selectedId)}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ threshold: 0.62 }),
      });
      if (response.status === 401 || response.status === 403) {
        handleUnauthorized("Admin session expired. Please sign in again.");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      renderAdminMatches(payload?.matches || []);
      renderMatchBroadcast((payload?.matches || [])[0] || null);
      notify(`Selected match run complete. ${payload?.count || 0} case(s) matched.`, "success");
    } catch (err) {
      notify("Failed to run selected person matching", "error");
    } finally {
      runSelectedBtn.disabled = false;
      runSelectedBtn.textContent = "Run Match For Selected";
      fetchAdminMatches();
      fetchMissingPersons();
    }
  });
}

