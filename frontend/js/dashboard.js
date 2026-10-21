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

function setAdminActionState(isAdmin) {
  isAdminSession = !!isAdmin;
  document.querySelectorAll(".admin-only-nav").forEach((el) => {
    el.classList.toggle("hidden", !isAdminSession);
  });
  document.querySelectorAll(".admin-only-section").forEach((el) => {
    el.classList.toggle("hidden", !isAdminSession);
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

function renderStats() {
  ensureDailyResolvedCounter();
  const markers = readJson(STORAGE_KEYS.markers, []);
  const queue = readJson(STORAGE_KEYS.offlineQueue, []);
  const contacts = readJson(STORAGE_KEYS.emergencyContacts, []);
  const resolvedToday = Number(localStorage.getItem(STORAGE_KEYS.resolvedCount) || "0");

  const activeAlertsEl = document.getElementById("activeAlertsCount");
  const respondersEl = document.getElementById("respondersCount");
  const resolvedEl = document.getElementById("resolvedTodayCount");

  if (activeAlertsEl) activeAlertsEl.textContent = String(markers.length + queue.length);
  if (respondersEl) respondersEl.textContent = String(contacts.length);
  if (resolvedEl) resolvedEl.textContent = String(resolvedToday);
}

function renderCommunityFeed() {
  const container = document.getElementById("communityFeed");
  if (!container) return;

  const markers = readJson(STORAGE_KEYS.markers, []).slice(-5).reverse();
  if (!markers.length) {
    container.innerHTML = `
      <div class="p-4 bg-white/5 rounded-xl border-l-2 border-blue-500">
        <p class="text-sm font-bold mb-1">No incidents yet</p>
        <p class="text-gray-400 text-sm">New reports from map markers and SOS submissions will appear here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = markers
    .map((item) => {
      const title = item.title || "SOS Alert";
      const description = item.description || "Incident reported";
      const time = formatTimeAgo(item.timestamp);
      return `
        <div class="p-4 bg-white/5 rounded-xl border-l-2 border-red-500">
          <p class="text-sm font-bold mb-1">${title} - ${time}</p>
          <p class="text-gray-400 text-sm">${description}</p>
        </div>
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
  if (warnings.length <= 1) {
    warningTrack.classList.add("static");
    warningTrack.innerHTML = warnings
      .map((warning) => `<span class="alert-item">${warning}</span>`)
      .join("");
    return;
  }

  warningTrack.classList.remove("static");
  warningTrack.innerHTML = warnings
    .concat(warnings)
    .map((warning) => `<span class="alert-item">${warning}</span>`)
    .join("");
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
    sosMarkers: readJson(STORAGE_KEYS.markers, []),
    offlineQueue: readJson(STORAGE_KEYS.offlineQueue, []),
    emergencyContacts: readJson(STORAGE_KEYS.emergencyContacts, []),
    resolvedToday: Number(localStorage.getItem(STORAGE_KEYS.resolvedCount) || "0"),
    generatedAt: new Date().toISOString(),
  };
  preview.textContent = JSON.stringify(snapshot, null, 2);
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
    await refreshWarnings();
    renderStats();
    renderCommunityFeed();
    renderWarningTicker();
    renderWarningList();
    renderMasterDataSnapshot();
    notify("Master data refreshed", "success");
  });
}

// Map
const map = L.map("map").setView([20.5937, 78.9629], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

let sosMarkers = JSON.parse(localStorage.getItem("sosMarkers")) || [];
sosMarkers.forEach((marker) => {
  L.marker([marker.lat, marker.lng])
    .addTo(map)
    .bindPopup(`<b>${marker.title}</b><br>${marker.description}`);
});

map.on("click", function (e) {
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
  L.marker([newMarker.lat, newMarker.lng])
    .addTo(map)
    .bindPopup(`<b>${title}</b><br>${description}`)
    .openPopup();
  sosMarkers.push(newMarker);
  localStorage.setItem("sosMarkers", JSON.stringify(sosMarkers));
  renderStats();
  renderCommunityFeed();
});

document.getElementById("clearMarkers").addEventListener("click", () => {
  if (confirm("Are you sure you want to clear all SOS markers?")) {
    localStorage.removeItem("sosMarkers");
    location.reload();
  }
});

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
  if (e.key === "crisisMitraLang") {
    setLanguage(e.newValue);
  }
  if ([STORAGE_KEYS.markers, STORAGE_KEYS.offlineQueue, STORAGE_KEYS.emergencyContacts, STORAGE_KEYS.resolvedCount].includes(e.key)) {
    renderStats();
    renderCommunityFeed();
    renderMasterDataSnapshot();
  }
  if (e.key === STORAGE_KEYS.warnings) {
    renderWarningTicker();
    renderWarningList();
    renderMasterDataSnapshot();
  }
});

async function initDashboard() {
  const isAdmin = await ensureAdminSession();
  setAdminActionState(isAdmin);
  await refreshWarnings();
  renderStats();
  renderCommunityFeed();
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
    renderStats();
    renderCommunityFeed();
    notify("Dashboard metrics refreshed", "success");
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
          <p class="text-xs text-gray-400 mb-2">${faceAvailable ? "AI face scoring available for this pair." : "No clear face detected in one or both images. Rule-based score only."}</p>
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
  const missingName = match?.missing?.personName || "Unknown";
  const foundName = match?.found?.personName || "Unknown";
  const contactName = match?.found?.contact?.name || match?.missing?.contact?.name || "N/A";
  const contactPhone = match?.found?.contact?.phone || match?.missing?.contact?.phone || "N/A";

  titleEl.textContent = `Match Found: ${missingName} ↔ ${foundName}`;
  bodyEl.textContent = faceAvailable
    ? `Person found. Contact ${contactName} at ${contactPhone}. AI face signal was used.`
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

