feather.replace();

const API_BASE_URL = localStorage.getItem("crisisMitraApiBase") || "https://backend-production-6882.up.railway.app";

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || "";
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? "-");
}

function renderEvidence(urls) {
  const grid = document.getElementById("evidenceMediaGrid");
  if (!grid) return;

  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  if (!list.length) {
    grid.innerHTML = '<p class="text-gray-400 text-sm">No media attached</p>';
    return;
  }

  grid.innerHTML = list
    .map((url, index) => {
      const safe = String(url);
      const lower = safe.toLowerCase();
      const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(lower);
      const isVideo = /\.(mp4|webm|ogg|mov)(\?|$)/.test(lower);

      if (isImage) {
        return `
          <a href="${safe}" target="_blank" rel="noopener noreferrer" class="block rounded-lg overflow-hidden border border-white/10 bg-black/20">
            <img src="${safe}" alt="evidence-${index + 1}" class="w-full h-36 object-cover" />
          </a>
        `;
      }

      if (isVideo) {
        return `
          <div class="rounded-lg overflow-hidden border border-white/10 bg-black/20 p-2">
            <video controls class="w-full h-36 object-cover rounded">
              <source src="${safe}" />
            </video>
          </div>
        `;
      }

      return `
        <a href="${safe}" target="_blank" rel="noopener noreferrer" class="p-3 rounded-lg border border-white/10 bg-black/20 text-xs text-blue-300 hover:text-blue-200 break-all">
          Open Media ${index + 1}
        </a>
      `;
    })
    .join("");
}

async function initSosAlertPage() {
  const alertId = getQueryParam("id");
  const emptyState = document.getElementById("emptyState");
  const detailsCard = document.getElementById("detailsCard");

  if (!alertId) {
    if (emptyState) emptyState.classList.remove("hidden");
    setText("alertMeta", "Invalid alert id.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/sos-alerts/${encodeURIComponent(alertId)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const item = payload?.item || {};
    const med = item?.medicalInfo || {};

    setText("detailName", item?.name || "Anonymous");
    setText("detailType", item?.type || "unknown");
    setText("detailPeople", item?.peopleCount || "N/A");
    setText("detailLocation", item?.location || "Unknown location");
    setText("detailTimestamp", new Date(item?.created_at || item?.timestamp || Date.now()).toLocaleString());
    setText("detailInjury", med?.injury || "N/A");
    setText("detailConditions", Array.isArray(med?.conditions) && med.conditions.length ? med.conditions.join(", ") : "None");
    setText("detailAllergies", med?.allergies || "None");
    setText("detailNotes", item?.details || "No additional details");
    setText("alertMeta", `Alert ID: ${item?._id || alertId}`);

    renderEvidence(item?.evidenceMedia || []);

    if (detailsCard) detailsCard.classList.remove("hidden");
  } catch (err) {
    if (emptyState) emptyState.classList.remove("hidden");
    setText("alertMeta", "Unable to load this alert.");
  }
}

initSosAlertPage();
