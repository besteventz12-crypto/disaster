feather.replace();

const API_BASE_URL = localStorage.getItem("crisisMitraApiBase") || "https://backend-production-6882.up.railway.app";
const ADMIN_TOKEN_KEY = "crisisMitraAdminToken";

const map = L.map("map").setView([20.5937, 78.9629], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const shelterLayer = L.layerGroup().addTo(map);
const returnToSOS = sessionStorage.getItem("returnToSOS");

let sosMarkers = JSON.parse(localStorage.getItem("sosMarkers") || "[]");
let isAdminSession = false;
let userLocationMarker = null;
let userRadiusCircle = null;

function notify(message, type = "info") {
  if (typeof window.showNotification === "function") {
    window.showNotification(message, type);
    return;
  }
  alert(message);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function setShelterStatus(text, tone = "neutral") {
  const el = document.getElementById("shelterStatus");
  if (!el) return;
  el.textContent = text;
  if (tone === "success") {
    el.className = "text-xs px-3 py-1 rounded-full bg-green-600/20 text-green-300";
    return;
  }
  if (tone === "error") {
    el.className = "text-xs px-3 py-1 rounded-full bg-red-600/20 text-red-300";
    return;
  }
  el.className = "text-xs px-3 py-1 rounded-full bg-white/10 text-gray-300";
}

async function ensureAdminSession() {
  const token = getAdminToken();
  if (!token) {
    isAdminSession = false;
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/admin/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    isAdminSession = response.ok;
    return isAdminSession;
  } catch (err) {
    isAdminSession = false;
    return false;
  }
}

function renderShelterMarkers(items) {
  shelterLayer.clearLayers();
  (items || []).forEach((item) => {
    const lat = Number(item.latitude);
    const lng = Number(item.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const popup = `
      <div style="min-width:200px">
        <strong>${escapeHtml(item.name || "Shelter")}</strong><br />
        ${item.distanceKm !== undefined ? `<small>Distance: ${item.distanceKm} km</small><br />` : ""}
        ${escapeHtml(item.address || "Address not available")}<br />
        Capacity: ${Number(item.capacity || 0)}<br />
        Contact: ${escapeHtml(item.contact || "N/A")}
      </div>
    `;

    L.marker([lat, lng]).addTo(shelterLayer).bindPopup(popup);
  });
}

function renderNearbyShelterList(items) {
  const list = document.getElementById("nearbyShelterList");
  if (!list) return;
  if (!Array.isArray(items) || !items.length) {
    list.innerHTML = '<p class="text-gray-400">No shelters found within 5 km.</p>';
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
      <article class="shelter-item">
        <p class="font-semibold text-green-300">${escapeHtml(item.name || "Shelter")}</p>
        <p class="text-xs text-gray-300 mt-1">Distance: ${item.distanceKm ?? "-"} km</p>
        <p class="text-xs text-gray-400 mt-1">${escapeHtml(item.address || "Address not available")}</p>
        <p class="text-xs text-gray-400">Capacity: ${Number(item.capacity || 0)} | Contact: ${escapeHtml(item.contact || "N/A")}</p>
      </article>
    `
    )
    .join("");
}

async function loadAllShelters() {
  try {
    const response = await fetch(`${API_BASE_URL}/shelters`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    renderShelterMarkers(payload?.items || []);
  } catch (err) {
    console.warn("Unable to load shelters", err);
  }
}

function updateUserLocationArtifacts(lat, lng) {
  if (userLocationMarker) map.removeLayer(userLocationMarker);
  if (userRadiusCircle) map.removeLayer(userRadiusCircle);
  userLocationMarker = L.marker([lat, lng]).addTo(map).bindPopup("Search center");
  userRadiusCircle = L.circle([lat, lng], {
    radius: 5000,
    color: "#3b82f6",
    fillColor: "#3b82f6",
    fillOpacity: 0.08,
  }).addTo(map);
}

async function findSheltersWithin5Km(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    notify("Enter valid latitude and longitude", "error");
    return;
  }

  setShelterStatus("Searching shelters within 5 km...", "neutral");
  try {
    const response = await fetch(
      `${API_BASE_URL}/shelters?latitude=${encodeURIComponent(latNum)}&longitude=${encodeURIComponent(lngNum)}&radiusKm=5`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const items = payload?.items || [];

    renderShelterMarkers(items);
    renderNearbyShelterList(items);
    updateUserLocationArtifacts(latNum, lngNum);
    map.setView([latNum, lngNum], 13);
    setShelterStatus(`${items.length} shelter(s) found within 5 km`, "success");
  } catch (err) {
    setShelterStatus("Shelter lookup failed", "error");
    notify("Unable to fetch nearby shelters", "error");
  }
}

async function findNearbyShelters() {
  if (!navigator.geolocation) {
    notify("Geolocation is not supported on this device", "error");
    return;
  }

  setShelterStatus("Locating...", "neutral");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = Number(position.coords.latitude.toFixed(6));
      const lng = Number(position.coords.longitude.toFixed(6));
      await findSheltersWithin5Km(lat, lng);
    },
    () => {
      setShelterStatus("Location access denied", "error");
      notify("Unable to get your current location", "error");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

sosMarkers.forEach((marker) => {
  L.marker([marker.lat, marker.lng]).addTo(map).bindPopup(`<b>${marker.title}</b><br>${marker.description}`);
});

map.on("click", async (e) => {
  if (returnToSOS === "true") {
    const coords = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    sessionStorage.setItem("selectedLocation", coords);
    sessionStorage.removeItem("returnToSOS");

    L.marker([e.latlng.lat, e.latlng.lng])
      .addTo(map)
      .bindPopup("<b>Selected Location</b><br>Returning to SOS page...")
      .openPopup();

    setTimeout(() => {
      window.location.href = "sos.html";
    }, 1000);
    return;
  }

  const title = prompt("Enter SOS Title (e.g. 'Flood Help Needed')");
  const description = prompt("Enter short description (e.g. '3 people stranded near river')");
  if (!title || !description) return;

  const newMarker = {
    lat: e.latlng.lat,
    lng: e.latlng.lng,
    title,
    description,
  };

  L.marker([newMarker.lat, newMarker.lng])
    .addTo(map)
    .bindPopup(`<b>${title}</b><br>${description}`)
    .openPopup();

  sosMarkers.push(newMarker);
  localStorage.setItem("sosMarkers", JSON.stringify(sosMarkers));
});

document.getElementById("clearMarkers")?.addEventListener("click", () => {
  if (confirm("Are you sure you want to clear all SOS markers?")) {
    localStorage.removeItem("sosMarkers");
    location.reload();
  }
});

document.getElementById("findNearbyShelters")?.addEventListener("click", findNearbyShelters);

document.getElementById("searchSheltersByCoords")?.addEventListener("click", async () => {
  const latValue = document.getElementById("shelterSearchLat")?.value || "";
  const lngValue = document.getElementById("shelterSearchLng")?.value || "";
  await findSheltersWithin5Km(latValue, lngValue);
});

if (returnToSOS === "true") {
  const instructionCard = document.querySelector(".card.p-6");
  if (instructionCard) {
    instructionCard.innerHTML = `
      <div class="w-12 h-12 bg-green-600/20 rounded-full flex items-center justify-center shrink-0">
        <i data-feather="map-pin" class="text-green-500"></i>
      </div>
      <div>
        <p class="text-white font-medium">Select Your Location</p>
        <p class="text-[#888] text-sm">
          Click anywhere on the map to <b class="text-green-400">select your location</b> for the SOS alert. You will be redirected back to the SOS page.
        </p>
      </div>
    `;
    feather.replace();
  }
}

async function initMapShelterAccess() {
  const adminOk = await ensureAdminSession();
  document.querySelectorAll(".admin-only-nav").forEach((el) => {
    el.classList.toggle("hidden", !adminOk);
  });

  if (adminOk) {
    setShelterStatus("Admin view: all shelters visible", "success");
    await loadAllShelters();
  } else {
    shelterLayer.clearLayers();
    renderNearbyShelterList([]);
    setShelterStatus("User view: search to see shelters within 5 km", "neutral");
  }
}

initMapShelterAccess();
