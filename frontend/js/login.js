feather.replace();

const translations = {
  en: {
    tagline: "Emergency Response Admin Dashboard",
    loginTitle: "Admin Login",
    emailLbl: "Email",
    emailPlaceholder: "admin@example.com",
    passwordLbl: "Password",
    passwordPlaceholder: "********",
    rememberMe: "Remember me",
    forgotPass: "Forgot password?",
    signIn: "Sign In",
    network: "Emergency Response Network",
  },
  hi: {
    tagline: "Emergency Response Admin Dashboard",
    loginTitle: "Admin Login",
    emailLbl: "Email",
    emailPlaceholder: "admin@example.com",
    passwordLbl: "Password",
    passwordPlaceholder: "********",
    rememberMe: "Remember me",
    forgotPass: "Forgot password?",
    signIn: "Sign In",
    network: "Emergency Response Network",
  },
  mr: {
    tagline: "Emergency Response Admin Dashboard",
    loginTitle: "Admin Login",
    emailLbl: "Email",
    emailPlaceholder: "admin@example.com",
    passwordLbl: "Password",
    passwordPlaceholder: "********",
    rememberMe: "Remember me",
    forgotPass: "Forgot password?",
    signIn: "Sign In",
    network: "Emergency Response Network",
  },
};

function setLanguage(lang) {
  localStorage.setItem("crisisMitraLang", lang); // Persistence
  const sel = document.getElementById("languageSelect");
  if (sel) sel.value = lang;

  // Text
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (translations[lang] && translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });

  // Placeholders
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (translations[lang] && translations[lang][key]) {
      el.placeholder = translations[lang][key];
    }
  });
}

// Initialize
const savedLang = localStorage.getItem("crisisMitraLang") || "en";
setLanguage(savedLang);

document
  .getElementById("languageSelect")
  .addEventListener("change", (e) => setLanguage(e.target.value));

const ADMIN_EMAIL = "admin@resqlink.com";
const ADMIN_PASSWORD = "ResQlink@2026";

const adminLoginForm = document.getElementById("admin-login-form");
if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = document.getElementById("email")?.value?.trim() || "";
    const password = document.getElementById("password")?.value || "";

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      localStorage.setItem(
        "crisisMitraUser",
        JSON.stringify({
          name: "Admin",
          isLoggedIn: true,
          role: "admin",
        })
      );
      showNotification("Admin login successful", "success");
      setTimeout(() => {
        window.location.href = "./admin-dashboard.html";
      }, 500);
      return;
    }

    showNotification("Invalid admin credentials", "error");
  });
}
