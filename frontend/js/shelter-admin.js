feather.replace();

const API_BASE_URL = localStorage.getItem("crisisMitraApiBase") || "http://localhost:5000";
const ADMIN_TOKEN_KEY = "crisisMitraAdminToken";

let selectorMap = null;
let selectorMarker = null;
let mapPickMode = false;

function notify(message, type = "info") {
  if (typeof window.showNotification === "function") {
    window.showNotification(message, type);
    return;
  }
  alert(message);
}

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function setMapPickState(enabled) {
  mapPickMode = !!enabled;
  const pill = document.getElementById("mapPickState");
  const button = document.getElementById("pickShelterOnMap");

  if (pill) {
    if (mapPickMode) {
      pill.textContent = "Map pick: ON";
      pill.className = "text-xs px-3 py-1 rounded-full bg-blue-600/20 text-blue-300";
    } else {
      pill.textContent = "Map pick: OFF";
      pill.className = "text-xs px-3 py-1 rounded-full bg-white/10 text-gray-300";
    }
  }

  if (button) {
    button.textContent = mapPickMode ? "Selecting... Click Map" : "Select On Map";
    button.className = mapPickMode
      ? "px-4 py-2 rounded-lg bg-blue-700 text-sm"
      : "px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm";
  }
}

function applyLatLng(lat, lng, recenter = false) {
  const latFixed = Number(lat).toFixed(6);
  const lngFixed = Number(lng).toFixed(6);

  const latEl = document.getElementById("shelterLat");
  const lngEl = document.getElementById("shelterLng");
  if (latEl) latEl.value = latFixed;
  if (lngEl) lngEl.value = lngFixed;

  if (selectorMap) {
    if (!selectorMarker) {
      selectorMarker = L.marker([Number(lat), Number(lng)]).addTo(selectorMap);
    } else {
      selectorMarker.setLatLng([Number(lat), Number(lng)]);
    }
    selectorMarker.bindPopup(`Selected: ${latFixed}, ${lngFixed}`);
    if (recenter) selectorMap.setView([Number(lat), Number(lng)], 14);
  }
}

function setupSelectorMap() {
  const mapContainer = document.getElementById("shelterSelectMap");
  if (!mapContainer || typeof L === "undefined") return;

  selectorMap = L.map("shelterSelectMap").setView([20.5937, 78.9629], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(selectorMap);

  selectorMap.on("click", (event) => {
    if (!mapPickMode) return;
    const lat = event.latlng.lat;
    const lng = event.latlng.lng;
    applyLatLng(lat, lng, false);
    setMapPickState(false);
    notify("Coordinates selected from map", "success");
  });
}

function setupMapPickButton() {
  const btn = document.getElementById("pickShelterOnMap");
  btn?.addEventListener("click", () => {
    setMapPickState(!mapPickMode);
    if (mapPickMode) {
      notify("Click on map to set shelter coordinates", "info");
    }
  });
}

function setAdminState(isAdmin) {
  const pill = document.getElementById("adminStatePill");
  const blocked = document.getElementById("adminOnlyBlocked");
  const content = document.getElementById("adminShelterContent");
  if (pill) {
    if (isAdmin) {
      pill.textContent = "Admin session active";
      pill.className = "text-xs px-3 py-1 rounded-full bg-emerald-600/20 text-emerald-300";
    } else {
      pill.textContent = "Admin login required";
      pill.className = "text-xs px-3 py-1 rounded-full bg-red-600/20 text-red-300";
    }
  }
  if (blocked) blocked.classList.toggle("hidden", !!isAdmin);
  if (content) content.classList.toggle("hidden", !isAdmin);
}

async function ensureAdminSession() {
  const token = getAdminToken();
  if (!token) {
    setAdminState(false);
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/admin/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const ok = response.ok;
    setAdminState(ok);
    return ok;
  } catch (err) {
    setAdminState(false);
    return false;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderShelterList(items) {
  const list = document.getElementById("shelterList");
  if (!list) return;

  if (!Array.isArray(items) || !items.length) {
    list.innerHTML = '<p class="text-sm text-gray-400">No shelters added yet.</p>';
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
      <article class="p-4 bg-white/5 rounded-xl border border-white/10">
        <p class="font-bold text-emerald-300">${escapeHtml(item.name || "Shelter")}</p>
        <p class="text-sm text-gray-300 mt-1">${escapeHtml(item.address || "Address unavailable")}</p>
        <p class="text-xs text-gray-400 mt-1">Lat: ${Number(item.latitude || 0).toFixed(6)} | Lng: ${Number(item.longitude || 0).toFixed(6)}</p>
        <p class="text-xs text-gray-400">Capacity: ${Number(item.capacity || 0)} | Contact: ${escapeHtml(item.contact || "N/A")}</p>
        ${item.notes ? `<p class="text-xs text-gray-400 mt-1">Notes: ${escapeHtml(item.notes)}</p>` : ""}
      </article>
    `
    )
    .join("");
}

async function fetchAllShelters() {
  try {
    const response = await fetch(`${API_BASE_URL}/shelters`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    renderShelterList(payload?.items || []);
  } catch (err) {
    renderShelterList([]);
    notify("Unable to load shelters", "error");
  }
}

function setupCurrentLocationButton() {
  const btn = document.getElementById("useCurrentShelterLocation");
  btn?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      notify("Geolocation is not supported", "error");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Locating...";

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        applyLatLng(lat, lng, true);
        notify("Location applied", "success");
        btn.disabled = false;
        btn.textContent = "Use Current Location";
      },
      () => {
        notify("Unable to fetch current location", "error");
        btn.disabled = false;
        btn.textContent = "Use Current Location";
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

function setupShelterForm() {
  const form = document.getElementById("shelterForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const isAdmin = await ensureAdminSession();
    if (!isAdmin) {
      notify("Please login as admin to add shelters", "error");
      return;
    }

    const token = getAdminToken();
    const payload = {
      name: document.getElementById("shelterName")?.value?.trim() || "",
      address: document.getElementById("shelterAddress")?.value?.trim() || "",
      contact: document.getElementById("shelterContact")?.value?.trim() || "",
      capacity: Number(document.getElementById("shelterCapacity")?.value || "0") || 0,
      notes: document.getElementById("shelterNotes")?.value?.trim() || "",
      latitude: Number(document.getElementById("shelterLat")?.value || ""),
      longitude: Number(document.getElementById("shelterLng")?.value || ""),
    };

    if (!payload.name || !Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
      notify("Enter shelter name and valid coordinates", "error");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/shelters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (response.status === 401 || response.status === 403) {
        setAdminState(false);
        notify("Admin session expired. Login again.", "error");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      form.reset();
      notify("Shelter saved successfully", "success");
      fetchAllShelters();
    } catch (err) {
      notify("Failed to save shelter", "error");
    }
  });
}

document.getElementById("refreshShelterList")?.addEventListener("click", fetchAllShelters);

async function initShelterAdmin() {
  const isAdmin = await ensureAdminSession();
  if (!isAdmin) {
    notify("Admin login required for shelter management", "error");
    setTimeout(() => {
      window.location.href = "./admin-login.html";
    }, 400);
    return;
  }
  setupSelectorMap();
  setupMapPickButton();
  setMapPickState(false);
  setupCurrentLocationButton();
  setupShelterForm();
  fetchAllShelters();
}

initShelterAdmin();
