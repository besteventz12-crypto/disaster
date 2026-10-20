// Vanta background
if (window.VANTA?.NET) {
  VANTA.NET({
    el: "#vanta-bg",
    color: 0xffffff,
    backgroundColor: 0x0a0a0a,
    points: 8,
    maxDistance: 15,
    spacing: 15,
  });
}

// Feather icons
feather.replace();

const API_BASE_URL = localStorage.getItem("crisisMitraApiBase") || "https://backend-production-6882.up.railway.app";
const WARNING_STORAGE_KEY = "adminWarnings";
const DEFAULT_WARNING = "Cyclone Warning: Immediate evacuation ordered for coastal Sector 7 and 9. Stay away from low-lying areas.";
const ADMIN_TOKEN_KEY = "crisisMitraAdminToken";

function isAdminLoggedInLocal() {
  try {
    const userRaw = localStorage.getItem("crisisMitraUser");
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || "";
    if (!userRaw || !token) return false;
    const user = JSON.parse(userRaw);
    return !!(user && user.isLoggedIn && user.role === "admin");
  } catch (err) {
    return false;
  }
}

function applyAdminOnlyVisibility(isAdmin) {
  document.querySelectorAll(".admin-only-nav").forEach((el) => {
    el.classList.toggle("hidden", !isAdmin);
    el.style.setProperty("display", isAdmin ? "" : "none", "important");
  });
}

async function verifyAdminSession() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  if (!token || !isAdminLoggedInLocal()) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/admin/session`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.ok;
  } catch (err) {
    return false;
  }
}

function normalizeWarnings(warnings) {
  const list = Array.isArray(warnings) ? warnings : [];
  const cleaned = list
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return cleaned.length ? cleaned : [DEFAULT_WARNING];
}

function renderGlobalWarningTicker(warningsInput) {
  const warningTrack = document.getElementById("warningTrack");
  if (!warningTrack) return;

  const warnings = normalizeWarnings(warningsInput);
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

  renderGlobalWarningTicker(localFallback);

  try {
    const response = await fetch(`${API_BASE_URL}/warnings`);
    if (!response.ok) {
      throw new Error(`Warning API request failed: ${response.status}`);
    }
    const payload = await response.json();
    const warnings = normalizeWarnings(payload?.warnings || []);
    localStorage.setItem(WARNING_STORAGE_KEY, JSON.stringify(warnings));
    renderGlobalWarningTicker(warnings);
  } catch (err) {
    console.warn("Warning API unavailable, using local warning data.", err);
  }
}

// Translations
const translations = {
  en: {
    every: "Every",
    secondCounts: "Second Counts",
    heroText:
      "Connect emergency responders with those in need through real-time coordination",
    sendSOS: "Send SOS",
    dashboard: "Dashboard",
    adminLogin: "Admin Login",
    criticalFunc: "Critical Functionalities",
    offlineAvail: "Offline Availability",
    offlineDesc:
      "Functionality remains available even without internet connection.",
    liveMap: "Live Incident Map",
    liveMapDesc:
      "Visualize emergencies and resources in real-time across affected areas.",
    aiAssist: "AI Assistant",
    aiAssistDesc:
      "Get critical information without internet using our NLP system.",
    needHelp: "Need Immediate Help?",
    emergencyAlert: "EMERGENCY ALERT",
    notifyMsg: "This will notify all nearby responders of your exact location",
    footerText: "Real-time disaster relief coordination",
    footerBrandDesc:
      "Empowering communities with real-time disaster relief coordination and life-saving communication tools.",
    platform: "Platform",
    resources: "Resources",
    newsletter: "Newsletter",
    newsletterDesc:
      "Stay updated with the latest disaster response protocols and platform updates.",
    liveIncidentMap: "Live Incident Map",
    sosSystem: "SOS System",
    responseDashboard: "Response Dashboard",
    safetyProtocols: "Safety Protocols",
    adminPortal: "Admin Dashboard",
    trainingModules: "Training Modules",
    developedResilience: "Developed for Resilience.",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    contactSupport: "Contact Support",
    logout: "Logout",
  },
  hi: {
    every: "हर",
    secondCounts: "सेकंड मायने रखता है",
    heroText: "आपातकालीन सहायता को ज़रूरतमंदों से रियल-टाइम में जोड़ें",
    sendSOS: "एसओएस भेजें",
    dashboard: "डैशबोर्ड",
    adminLogin: "Admin Login",
    criticalFunc: "मुख्य विशेषताएँ",
    offlineAvail: "ऑफलाइन सुविधा",
    offlineDesc: "इंटरनेट न होने पर भी कार्य उपलब्ध रहेगा।",
    liveMap: "लाइव घटना मानचित्र",
    liveMapDesc:
      "प्रभावित क्षेत्रों में आपात स्थितियों और संसाधनों को रियल-टाइम में देखें।",
    aiAssist: "एआई सहायक",
    aiAssistDesc:
      "हमारे NLP सिस्टम का उपयोग करके बिना इंटरनेट जानकारी प्राप्त करें।",
    needHelp: "तुरंत मदद चाहिए?",
    emergencyAlert: "आपातकालीन चेतावनी",
    notifyMsg: "यह आपके आस-पास के सभी उत्तरदाताओं को सूचित करेगा।",
    footerText: "रियल-टाइम आपदा राहत समन्वय",
    footerBrandDesc:
      "समुदायों को रियल-टाइम आपदा राहत समन्वय और जीवन रक्षक संचार उपकरणों के साथ सशक्त बनाना।",
    platform: "प्लेटफॉर्म",
    resources: "संसाधन",
    newsletter: "न्यूज़लेटर",
    newsletterDesc:
      "नवीनतम आपदा प्रतिक्रिया प्रोटोकॉल और प्लेटफॉर्म अपडेट के साथ अपडेट रहें।",
    liveIncidentMap: "लाइव घटना मानचित्र",
    sosSystem: "एसओएस सिस्टम",
    responseDashboard: "रिस्पॉन्स डैशबोर्ड",
    safetyProtocols: "सुरक्षा प्रोटोकॉल",
    adminPortal: "Admin Dashboard",
    trainingModules: "प्रशिक्षण मॉड्यूल",
    developedResilience: "लचीलेपन के लिए विकसित।",
    privacyPolicy: "गोपनीयता नीति",
    termsOfService: "सेवा की शर्तें",
    contactSupport: "संपर्क सहायता",
    logout: "लॉगआउट",
  },
  mr: {
    every: "प्रत्येक",
    secondCounts: "सेकंद महत्त्वाचा आहे",
    heroText: "आपत्कालीन मदतकार्यकर्त्यांना गरजू लोकांशी रिअल-टाइममध्ये जोडा",
    sendSOS: "एसओएस पाठवा",
    dashboard: "डॅशबोर्ड",
    adminLogin: "Admin Login",
    criticalFunc: "महत्त्वपूर्ण कार्ये",
    offlineAvail: "ऑफलाइन उपलब्धता",
    offlineDesc: "इंटरनेटशिवाय देखील कार्य उपलब्ध राहील.",
    liveMap: "लाइव्ह घटना नकाशा",
    liveMapDesc:
      "प्रभावित भागातील आपत्कालीन घटना आणि साधने रिअल-टाइममध्ये पहा.",
    aiAssist: "एआय सहाय्यक",
    aiAssistDesc: "इंटरनेटशिवाय आमच्या NLP प्रणालीद्वारे माहिती मिळवा.",
    needHelp: "त्वरित मदत हवी आहे?",
    emergencyAlert: "आपत्कालीन सूचना",
    notifyMsg: "हे आपल्या आसपासच्या सर्व प्रतिसादकर्त्यांना सूचित करेल.",
    footerText: "रिअल-टाइम आपत्ती निवारण समन्वय",
    footerBrandDesc:
      "रिअल-टाइम आपत्ती निवारण समन्वय आणि जीवनरक्षक संवाद साधनांद्वारे समुदायांना सक्षम करणे.",
    platform: "प्लॅटफॉर्म",
    resources: "संसाधने",
    newsletter: "न्यूजलेटर",
    newsletterDesc:
      "नवीनतम आपत्ती प्रतिसाद प्रोटोकॉल आणि प्लॅटफॉर्म अद्यतनांसह अद्यतनित रहा.",
    liveIncidentMap: "लाइव्ह घटना नकाशा",
    sosSystem: "एसओएस सिस्टम",
    responseDashboard: "रिस्पॉन्स डॅशबोर्ड",
    safetyProtocols: "सुरक्षा प्रोटोकॉल",
    adminPortal: "Admin Dashboard",
    trainingModules: "प्रशिक्षण मॉड्यूल",
    developedResilience: "लवचिकतेसाठी विकसित.",
    privacyPolicy: "गोपनीयता धोरण",
    termsOfService: "सेवा अटी",
    contactSupport: "संपर्क समर्थन",
    logout: "लॉगआउट",
  },
};

function setLanguage(lang) {
  localStorage.setItem("crisisMitraLang", lang);

  // Update Buttons UI
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

// Lang Sync across tabs
window.addEventListener("storage", (e) => {
  if (e.key === "crisisMitraLang") {
    setLanguage(e.newValue);
  }
});

// Check Login State for Hero UI
function checkLoginState() {
  const user = localStorage.getItem("crisisMitraUser");
  const loginBtn = document.getElementById("user-login-btn");

  if (user) {
    const userData = JSON.parse(user);
    if (userData.isLoggedIn) {
      if (loginBtn) {
        loginBtn.innerHTML = `
          <i data-feather="log-out"></i>
          <span data-i18n="logout">Logout</span>
        `;
        loginBtn.classList.remove("border-white");
        loginBtn.classList.add(
          "border-red-500",
          "text-red-500",
          "hover:bg-red-500",
          "hover:text-white"
        );
        loginBtn.href = "javascript:void(0)";
        loginBtn.onclick = () => {
          localStorage.removeItem("crisisMitraUser");
          window.location.reload();
        };
        feather.replace();
      }
    }
  }
}

// Initialize UI
checkLoginState();
applyAdminOnlyVisibility(false);

(async () => {
  const isAdmin = await verifyAdminSession();
  applyAdminOnlyVisibility(isAdmin);
})();
hydrateWarningBanner();
