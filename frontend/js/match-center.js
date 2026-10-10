feather.replace();

const API_BASE_URL = localStorage.getItem("crisisMitraApiBase") || "http://localhost:5000";
const WARNING_STORAGE_KEY = "adminWarnings";
const DEFAULT_WARNING = "Report verified information only. Emergency teams will review each submission.";
const ADMIN_TOKEN_KEY = "crisisMitraAdminToken";

let missingReportsCache = [];
let isAdminSession = false;

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

function notify(message, type = "info") {
  if (typeof window.showNotification === "function") {
    window.showNotification(message, type);
    return;
  }
  alert(message);
}

function normalizeWarnings(warnings) {
  const list = Array.isArray(warnings) ? warnings : [];
  const cleaned = list.map((item) => String(item || "").trim()).filter(Boolean);
  return cleaned.length ? cleaned : [DEFAULT_WARNING];
}

function renderWarningTicker(warningsInput) {
  const warningTrack = document.getElementById("warningTrack");
  if (!warningTrack) return;

  const warnings = normalizeWarnings(warningsInput);
  if (warnings.length <= 1) {
    warningTrack.classList.add("static");
    warningTrack.innerHTML = warnings.map((warning) => `<span class="alert-item">${warning}</span>`).join("");
    return;
  }

  warningTrack.classList.remove("static");
  warningTrack.innerHTML = warnings
    .concat(warnings)
    .map((warning) => `<span class="alert-item">${warning}</span>`)
    .join("");
}

async function hydrateWarningBanner() {
  const localFallback = normalizeWarnings(
    (() => {
      try {
        return JSON.parse(localStorage.getItem(WARNING_STORAGE_KEY) || "[]");
      } catch (err) {
        return [];
      }
    })()
  );
  renderWarningTicker(localFallback);

  try {
    const response = await fetch(`${API_BASE_URL}/warnings`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const warnings = normalizeWarnings(payload?.warnings || []);
    localStorage.setItem(WARNING_STORAGE_KEY, JSON.stringify(warnings));
    renderWarningTicker(warnings);
  } catch (err) {
    console.warn("Warning API unavailable", err);
  }
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

  const score = Number(match.score || 0).toFixed(2);
  const missingName = match?.missing?.personName || "Unknown";
  const foundName = match?.found?.personName || "Unknown";
  const contactName = match?.found?.contact?.name || match?.missing?.contact?.name || "N/A";
  const contactPhone = match?.found?.contact?.phone || match?.missing?.contact?.phone || "N/A";

  titleEl.textContent = `Match Found: ${missingName} <-> ${foundName}`;
  bodyEl.textContent = `Person found. Contact ${contactName} at ${contactPhone}.`;
  scoreEl.textContent = `score ${score}`;
  banner.classList.remove("hidden");
}

function renderAdminMatches(matches) {
  const container = document.getElementById("adminMatchResults");
  if (!container) return;

  if (!Array.isArray(matches) || !matches.length) {
    container.innerHTML = `
      <div class="p-4 bg-white/5 rounded-xl border border-white/10">
        <p class="text-sm text-gray-300">No matches found yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = matches
    .map((item) => {
      const score = Number(item.score || 0).toFixed(2);
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
            <div class="p-3 bg-black/30 rounded-lg border border-white/10 text-sm">
              <p class="text-xs uppercase text-gray-400 mb-1">Contact Missing Reporter</p>
              <p>${missingContact.name || "N/A"}</p>
              <p>${missingContact.phone || "N/A"}</p>
            </div>
            <div class="p-3 bg-black/30 rounded-lg border border-white/10 text-sm">
              <p class="text-xs uppercase text-gray-400 mb-1">Contact Found Reporter</p>
              <p>${foundContact.name || "N/A"}</p>
              <p>${foundContact.phone || "N/A"}</p>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
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
    const items = payload?.items || [];
    renderAdminMatches(items);
    renderMatchBroadcast(items[0] || null);
  } catch (err) {
    renderAdminMatches([]);
    renderMatchBroadcast(null);
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
      runMatchBtn.textContent = "Run Match (All)";
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

async function initMatchCenter() {
  const isAdmin = await ensureAdminSession();
  setAdminActionState(isAdmin);
  setupMatchingControls();
  fetchAdminMatches();
  if (isAdmin) {
    fetchMissingPersons();
  }
  hydrateWarningBanner();
}

initMatchCenter();
