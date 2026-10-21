feather.replace();

const API_BASE_URL = localStorage.getItem("crisisMitraApiBase") || "https://backend-production-6882.up.railway.app";
const WARNING_STORAGE_KEY = "adminWarnings";

function notify(message, type = "info") {
  if (typeof window.showNotification === "function") {
    window.showNotification(message, type);
    return;
  }

  const popup = document.createElement("div");
  popup.textContent = String(message || "");
  popup.style.position = "fixed";
  popup.style.right = "16px";
  popup.style.top = "16px";
  popup.style.zIndex = "9999";
  popup.style.maxWidth = "380px";
  popup.style.padding = "10px 14px";
  popup.style.borderRadius = "10px";
  popup.style.fontSize = "13px";
  popup.style.fontWeight = "600";
  popup.style.boxShadow = "0 8px 30px rgba(0,0,0,0.35)";
  popup.style.border = "1px solid rgba(255,255,255,0.14)";

  if (type === "success") {
    popup.style.background = "#14532d";
    popup.style.color = "#bbf7d0";
  } else if (type === "error") {
    popup.style.background = "#7f1d1d";
    popup.style.color = "#fecaca";
  } else {
    popup.style.background = "#1f2937";
    popup.style.color = "#e5e7eb";
  }

  document.body.appendChild(popup);
  window.setTimeout(() => popup.remove(), 3600);
}

function setUploadStatus(statusEl, text, type = "info") {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.remove("text-gray-400", "text-green-400", "text-red-400", "text-blue-400");

  if (type === "success") {
    statusEl.classList.add("text-green-400");
  } else if (type === "error") {
    statusEl.classList.add("text-red-400");
  } else if (type === "progress") {
    statusEl.classList.add("text-blue-400");
  } else {
    statusEl.classList.add("text-gray-400");
  }
}

function normalizeWarnings(warnings) {
  const list = Array.isArray(warnings) ? warnings : [];
  const cleaned = list.map((item) => String(item || "").trim()).filter(Boolean);
  return cleaned.length
    ? cleaned
    : ["Report verified information only. Emergency teams will review each submission."];
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
  warningTrack.innerHTML = warnings.concat(warnings).map((warning) => `<span class="alert-item">${warning}</span>`).join("");
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

function toNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatScoreOutOfTen(value) {
  const normalized = Math.max(0, Math.min(1, Number(value) || 0));
  return `${(normalized * 10).toFixed(1)} out of 10`;
}

function toDateTimeLocalString(date) {
  const pad = (num) => String(num).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function setupDummyFillButtons() {
  const fillMissingBtn = document.getElementById("fillMissingDummy");
  const fillFoundBtn = document.getElementById("fillFoundDummy");

  fillMissingBtn?.addEventListener("click", () => {
    const seenDate = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const values = {
      missingPersonName: "Rahul Sharma",
      missingAge: "14",
      missingGender: "Male",
      missingSeenAt: toDateTimeLocalString(seenDate),
      missingLocation: "Sector 21 Bus Stand, Noida",
      missingLat: "28.572268",
      missingLng: "77.327486",
      missingClothing: "Blue t-shirt, black jeans, white shoes",
      missingPhysical: "Height around 5 ft, slim build, short black hair",
      missingNotes: "Last seen carrying a red school bag",
      missingContactName: "Anita Sharma",
      missingContactPhone: "+91-9876543210",
      missingContactRelation: "Mother",
    };

    Object.entries(values).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });

    notify("Dummy data filled for Missing Person form", "success");
  });

  fillFoundBtn?.addEventListener("click", () => {
    const foundDate = new Date(Date.now() - 45 * 60 * 1000);

    const values = {
      foundPersonName: "Unknown teenage boy",
      foundAge: "14",
      foundGender: "Male",
      foundAt: toDateTimeLocalString(foundDate),
      foundLocation: "Metro Station Gate 2, Sector 18",
      foundLat: "28.570743",
      foundLng: "77.324267",
      foundClothing: "Blue t-shirt, black jeans, white shoes",
      foundPhysical: "Slim build, short black hair, appears disoriented",
      foundNotes: "Seen waiting near food stall and looked lost",
      foundContactName: "Rakesh Verma",
      foundContactPhone: "+91-9123456780",
      foundContactRelation: "Shopkeeper",
    };

    Object.entries(values).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });

    notify("Dummy data filled for Found/Suspicion form", "success");
  });
}

async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );
    if (!response.ok) return `${lat}, ${lng}`;
    const payload = await response.json();
    return payload?.display_name || `${lat}, ${lng}`;
  } catch (err) {
    return `${lat}, ${lng}`;
  }
}

function setupLocationButton(buttonId, latId, lngId, locationId) {
  const button = document.getElementById(buttonId);
  button?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      notify("Geolocation is not supported on this device", "error");
      return;
    }

    button.disabled = true;
    button.textContent = "Locating...";

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));

        const latEl = document.getElementById(latId);
        const lngEl = document.getElementById(lngId);
        const locationEl = document.getElementById(locationId);

        if (latEl) latEl.value = String(lat);
        if (lngEl) lngEl.value = String(lng);

        if (locationEl) {
          locationEl.value = await reverseGeocode(lat, lng);
        }

        notify("Current location applied", "success");
        button.disabled = false;
        button.textContent = "Use Current Location";
      },
      () => {
        notify("Unable to fetch current location", "error");
        button.disabled = false;
        button.textContent = "Use Current Location";
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

async function uploadImageToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  const url = payload?.result?.cloudinary_url || payload?.result?.secure_url || "";
  if (!url) throw new Error("Upload succeeded but no URL returned");
  return url;
}

function humanFaceValidationMessage(code) {
  const normalized = String(code || "").trim().toUpperCase();
  const messageMap = {
    NO_FACE_DETECTED: "No human face detected. Please upload a clear human face photo.",
    INVALID_IMAGE_URL: "Invalid image URL received. Please try uploading again.",
    UNSUPPORTED_IMAGE: "Unsupported image format. Please upload a valid image.",
    BROKEN_IMAGE: "Image could not be read. Please upload a different photo.",
    AI_TIMEOUT: "Face check timed out. Please try again.",
    AI_SERVICE_UNAVAILABLE: "Face check service is unavailable. Please try again in a moment.",
    AI_PROCESSING_FAILED: "Face check failed. Please upload a clearer image.",
    INVALID_EMBEDDING: "Face check failed due to invalid face data. Use another image.",
    NO_IMAGE_URL: "No uploaded image URL found. Please upload again.",
  };
  return messageMap[normalized] || "Face verification failed. Upload a clear human face photo.";
}

async function validateUploadedPhotoHasFace(photoUrl) {
  const response = await fetch(`${API_BASE_URL}/face/validate-photo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoUrl }),
  });

  if (!response.ok) {
    throw new Error("FACE_VALIDATION_REQUEST_FAILED");
  }

  const payload = await response.json();
  const result = payload?.result || {};
  const faceDetected = Boolean(result?.faceDetected);
  if (!faceDetected) {
    const code = result?.faceProcessingError || "NO_FACE_DETECTED";
    throw new Error(code);
  }

  return true;
}

async function uploadAndValidateHumanPhoto(file, statusEl) {
  setUploadStatus(statusEl, "Uploading to Cloudinary...", "progress");
  const uploadedUrl = await uploadImageToCloudinary(file);

  setUploadStatus(statusEl, "Checking for human face...", "progress");
  await validateUploadedPhotoHasFace(uploadedUrl);

  setUploadStatus(statusEl, "Photo uploaded and face verified", "success");
  return uploadedUrl;
}

async function ensureCloudinaryPhotoUrl({ fileId, urlId, statusId }) {
  const fileInput = document.getElementById(fileId);
  const urlInput = document.getElementById(urlId);
  const statusEl = document.getElementById(statusId);

  const selectedFile = fileInput?.files?.[0];
  const existingUrl = urlInput?.value?.trim() || "";

  if (!selectedFile) {
    return existingUrl;
  }

  const selectedFileSignature = `${selectedFile.name}:${selectedFile.size}:${selectedFile.lastModified}`;
  const uploadedFileSignature = urlInput?.dataset?.uploadedFileSignature || "";

  if (!existingUrl) {
    throw new Error("Please click Upload Photo first, then submit. If upload failed, re-upload a clear human face photo.");
  }

  if (uploadedFileSignature && uploadedFileSignature !== selectedFileSignature) {
    throw new Error("Selected image was changed after upload. Please click Upload Photo again to re-upload.");
  }

  return existingUrl;
}

function setupPhotoUpload(uploadBtnId, fileId, urlId, statusId) {
  const uploadBtn = document.getElementById(uploadBtnId);
  const fileInput = document.getElementById(fileId);
  const urlInput = document.getElementById(urlId);
  const statusEl = document.getElementById(statusId);

  uploadBtn?.addEventListener("click", async () => {
    const file = fileInput?.files?.[0];
    if (!file) {
      notify("Select an image first", "error");
      return;
    }

    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading...";
    try {
      const url = await uploadAndValidateHumanPhoto(file, statusEl);
      if (urlInput) {
        urlInput.value = url;
        urlInput.dataset.uploadedFileSignature = `${file.name}:${file.size}:${file.lastModified}`;
      }
      notify("Image uploaded and human face verified", "success");
    } catch (err) {
      const code = err instanceof Error ? err.message : "NO_FACE_DETECTED";
      const message = humanFaceValidationMessage(code);
      setUploadStatus(statusEl, "Upload rejected", "error");
      if (urlInput) {
        urlInput.value = "";
        delete urlInput.dataset.uploadedFileSignature;
      }
      notify(message, "error");
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload Photo";
    }
  });
}

function setupFormSwitcher() {
  const missingForm = document.getElementById("missingPersonForm");
  const foundForm = document.getElementById("foundPersonForm");
  const showMissingForm = document.getElementById("showMissingForm");
  const showFoundForm = document.getElementById("showFoundForm");

  showMissingForm?.addEventListener("click", () => {
    missingForm?.classList.remove("hidden");
    foundForm?.classList.add("hidden");
  });

  showFoundForm?.addEventListener("click", () => {
    foundForm?.classList.remove("hidden");
    missingForm?.classList.add("hidden");
  });

  if (window.location.hash === "#found") {
    foundForm?.classList.remove("hidden");
    missingForm?.classList.add("hidden");
  }
}

function setupMissingForm() {
  const form = document.getElementById("missingPersonForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const photoUrl = await ensureCloudinaryPhotoUrl({
        fileId: "missingPhoto",
        urlId: "missingPhotoUrl",
        statusId: "missingPhotoStatus",
      });

      const payload = {
      personName: document.getElementById("missingPersonName")?.value?.trim() || "",
      age: toNumberOrNull(document.getElementById("missingAge")?.value),
      gender: document.getElementById("missingGender")?.value?.trim() || "",
      clothingDescription: document.getElementById("missingClothing")?.value?.trim() || "",
      physicalDescription: document.getElementById("missingPhysical")?.value?.trim() || "",
      lastSeenLocation: document.getElementById("missingLocation")?.value?.trim() || "",
      latitude: toNumberOrNull(document.getElementById("missingLat")?.value),
      longitude: toNumberOrNull(document.getElementById("missingLng")?.value),
      seenAt: document.getElementById("missingSeenAt")?.value || "",
      notes: document.getElementById("missingNotes")?.value?.trim() || "",
      photoUrl,
      contact: {
        name: document.getElementById("missingContactName")?.value?.trim() || "",
        phone: document.getElementById("missingContactPhone")?.value?.trim() || "",
        relation: document.getElementById("missingContactRelation")?.value?.trim() || "",
      },
      };

      const response = await fetch(`${API_BASE_URL}/missing-persons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      form.reset();
      const urlEl = document.getElementById("missingPhotoUrl");
      if (urlEl?.dataset) delete urlEl.dataset.uploadedFileSignature;
      const statusEl = document.getElementById("missingPhotoStatus");
      setUploadStatus(statusEl, "No photo uploaded", "neutral");
      notify("Missing person report submitted", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to submit missing report (or upload image)", "error");
    }
  });
}

function setupFoundForm() {
  const form = document.getElementById("foundPersonForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const photoUrl = await ensureCloudinaryPhotoUrl({
        fileId: "foundPhoto",
        urlId: "foundPhotoUrl",
        statusId: "foundPhotoStatus",
      });

      const payload = {
      personName: document.getElementById("foundPersonName")?.value?.trim() || "Unknown",
      estimatedAge: toNumberOrNull(document.getElementById("foundAge")?.value),
      gender: document.getElementById("foundGender")?.value?.trim() || "",
      clothingDescription: document.getElementById("foundClothing")?.value?.trim() || "",
      physicalDescription: document.getElementById("foundPhysical")?.value?.trim() || "",
      foundLocation: document.getElementById("foundLocation")?.value?.trim() || "",
      latitude: toNumberOrNull(document.getElementById("foundLat")?.value),
      longitude: toNumberOrNull(document.getElementById("foundLng")?.value),
      foundAt: document.getElementById("foundAt")?.value || "",
      suspicionNotes: document.getElementById("foundNotes")?.value?.trim() || "",
      photoUrl,
      contact: {
        name: document.getElementById("foundContactName")?.value?.trim() || "",
        phone: document.getElementById("foundContactPhone")?.value?.trim() || "",
        relation: document.getElementById("foundContactRelation")?.value?.trim() || "",
      },
      };

      const response = await fetch(`${API_BASE_URL}/found-persons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      form.reset();
      const urlEl = document.getElementById("foundPhotoUrl");
      if (urlEl?.dataset) delete urlEl.dataset.uploadedFileSignature;
      const statusEl = document.getElementById("foundPhotoStatus");
      setUploadStatus(statusEl, "No photo uploaded", "neutral");
      notify("Found/Suspicion report submitted", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to submit found report (or upload image)", "error");
    }
  });
}

function renderPublicMatches(matches) {
  const container = document.getElementById("publicMatchResults");
  if (!container) return;

  if (!Array.isArray(matches) || !matches.length) {
    container.innerHTML = `
      <div class="p-4 bg-white/5 rounded-xl border border-white/10">
        <p class="text-sm text-gray-300">No matches published yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = matches
    .slice(0, 10)
    .map((item) => {
      const score = formatScoreOutOfTen(item.score);
      const faceAvailable = Boolean(item?.ai?.faceAvailable);
      const missingName = item?.missing?.personName || "Unknown";
      const foundName = item?.found?.personName || "Unknown";
      const missingContact = item?.missing?.contact || {};
      const foundContact = item?.found?.contact || {};
      return `
        <article class="p-4 bg-white/5 rounded-xl border border-green-500/30">
          <div class="flex items-center justify-between gap-3 mb-2">
            <h3 class="font-bold text-green-300">Match Found</h3>
            <span class="text-xs px-2 py-1 rounded bg-green-600/20 text-green-300">score ${score}</span>
          </div>
          <p class="text-xs text-gray-400 mb-2">${faceAvailable ? "AI face scoring available for this pair." : "No clear face detected in one or both images. Rule-based score only."}</p>
          <p class="text-sm"><strong>Missing:</strong> ${missingName}</p>
          <p class="text-sm mb-3"><strong>Found/Suspected:</strong> ${foundName}</p>
          <div class="grid md:grid-cols-2 gap-3 text-sm">
            <div class="p-3 bg-black/30 rounded-lg border border-white/10">
              <p class="text-xs text-gray-400 mb-1 uppercase">Whom to Contact (Missing Reporter)</p>
              <p>${missingContact.name || "N/A"}</p>
              <p>${missingContact.phone || "N/A"}</p>
            </div>
            <div class="p-3 bg-black/30 rounded-lg border border-white/10">
              <p class="text-xs text-gray-400 mb-1 uppercase">Whom to Contact (Found Reporter)</p>
              <p>${foundContact.name || "N/A"}</p>
              <p>${foundContact.phone || "N/A"}</p>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadPublicMatches() {
  try {
    const response = await fetch(`${API_BASE_URL}/matches`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    renderPublicMatches(payload?.items || []);
  } catch (err) {
    renderPublicMatches([]);
  }
}

setupFormSwitcher();
setupLocationButton("useMissingCurrentLocation", "missingLat", "missingLng", "missingLocation");
setupLocationButton("useFoundCurrentLocation", "foundLat", "foundLng", "foundLocation");
setupPhotoUpload("uploadMissingPhoto", "missingPhoto", "missingPhotoUrl", "missingPhotoStatus");
setupPhotoUpload("uploadFoundPhoto", "foundPhoto", "foundPhotoUrl", "foundPhotoStatus");
setupDummyFillButtons();
setupMissingForm();
setupFoundForm();
hydrateWarningBanner();
loadPublicMatches();
