feather.replace();

const API_BASE_URL = localStorage.getItem("crisisMitraApiBase") || "https://backend-production-6882.up.railway.app";
const ADMIN_TOKEN_KEY = "crisisMitraAdminToken";

function notify(message, type = "info") {
  if (typeof window.showNotification === "function") {
    window.showNotification(message, type);
    return;
  }
  console.log(`[${type}] ${message}`);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function authHeaders(extra = {}) {
  const token = getAdminToken();
  if (!token) return null;
  return {
    ...extra,
    Authorization: `Bearer ${token}`,
  };
}

async function fetchItems(endpoint) {
  const response = await fetch(`${API_BASE_URL}/${endpoint}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload?.items) ? payload.items : [];
}

function cardActions(type, id) {
  const isAdmin = Boolean(getAdminToken());
  if (!isAdmin) {
    return "";
  }
  return `<button data-delete-type="${type}" data-delete-id="${id}" class="delete-report-btn text-xs px-3 py-1 rounded bg-red-600/20 text-red-300 hover:bg-red-600/30">Delete</button>`;
}

function renderPhoto(photoUrl, altText) {
  const safeUrl = String(photoUrl || "").trim();
  if (!safeUrl) {
    return '<div class="w-16 h-16 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-[10px] text-gray-400">No Photo</div>';
  }

  return `
    <a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="block">
      <img src="${escapeHtml(safeUrl)}" alt="${escapeHtml(altText)}" class="w-16 h-16 rounded-lg object-cover border border-white/20" />
    </a>
  `;
}

function renderMissingList(items) {
  const container = document.getElementById("missingList");
  const countEl = document.getElementById("missingCount");
  if (!container || !countEl) return;

  countEl.textContent = String(items.length);
  if (!items.length) {
    container.innerHTML = '<div class="p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-400">No missing person reports.</div>';
    return;
  }

  container.innerHTML = items
    .map((item) => {
      const id = item?._id || "";
      const photo = renderPhoto(item?.photoUrl, `${item?.personName || "Missing person"} photo`);
      return `
        <div class="p-3 rounded-xl bg-white/5 border border-white/10">
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="flex items-start gap-3 min-w-0">
              ${photo}
              <div class="min-w-0">
              <p class="font-semibold">${escapeHtml(item?.personName || "Unknown")}</p>
              <p class="text-xs text-gray-400">${escapeHtml(item?.lastSeenLocation || "Unknown location")}</p>
              </div>
            </div>
            ${cardActions("missing", id)}
          </div>
          <p class="text-sm text-gray-300">Contact: ${escapeHtml(item?.contact?.name || "N/A")} (${escapeHtml(item?.contact?.phone || "N/A")})</p>
        </div>
      `;
    })
    .join("");
}

function renderFoundList(items) {
  const container = document.getElementById("foundList");
  const countEl = document.getElementById("foundCount");
  if (!container || !countEl) return;

  countEl.textContent = String(items.length);
  if (!items.length) {
    container.innerHTML = '<div class="p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-400">No found/suspicion reports.</div>';
    return;
  }

  container.innerHTML = items
    .map((item) => {
      const id = item?._id || "";
      const photo = renderPhoto(item?.photoUrl, `${item?.personName || "Found person"} photo`);
      return `
        <div class="p-3 rounded-xl bg-white/5 border border-white/10">
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="flex items-start gap-3 min-w-0">
              ${photo}
              <div class="min-w-0">
              <p class="font-semibold">${escapeHtml(item?.personName || "Unknown")}</p>
              <p class="text-xs text-gray-400">${escapeHtml(item?.foundLocation || "Unknown location")}</p>
              </div>
            </div>
            ${cardActions("found", id)}
          </div>
          <p class="text-sm text-gray-300">Contact: ${escapeHtml(item?.contact?.name || "N/A")} (${escapeHtml(item?.contact?.phone || "N/A")})</p>
        </div>
      `;
    })
    .join("");
}

async function loadLists() {
  try {
    const [missingItems, foundItems] = await Promise.all([
      fetchItems("missing-persons"),
      fetchItems("found-persons"),
    ]);
    renderMissingList(missingItems);
    renderFoundList(foundItems);
  } catch (err) {
    notify("Failed to load person report lists", "error");
  }
}

async function deleteRecord(type, id) {
  if (!id) return;

  const headers = authHeaders();
  if (!headers) {
    notify("Admin login required to delete", "error");
    return;
  }

  const endpoint = type === "found" ? `found-persons/${encodeURIComponent(id)}` : `missing-persons/${encodeURIComponent(id)}`;
  try {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: "DELETE",
      headers,
    });
    if (response.status === 401 || response.status === 403) {
      notify("Admin session expired. Please login again.", "error");
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    notify("Report deleted", "success");
    await loadLists();
  } catch (err) {
    notify("Delete failed", "error");
  }
}

function setupActions() {
  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.id === "refreshListsBtn") {
      await loadLists();
      return;
    }

    if (!target.classList.contains("delete-report-btn")) return;

    const type = target.getAttribute("data-delete-type") || "missing";
    const id = target.getAttribute("data-delete-id") || "";
    if (!confirm("Delete this report? This cannot be undone.")) return;
    await deleteRecord(type, id);
  });
}

setupActions();
loadLists();
