feather.replace();

const API_BASE_URL = localStorage.getItem("crisisMitraApiBase") || "http://localhost:5000";
const ADMIN_TOKEN_KEY = "crisisMitraAdminToken";

const loginForm = document.getElementById("adminLoginForm");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const passwordInput = document.getElementById("password");

function notify(message, type) {
  if (typeof showNotification === "function") {
    showNotification(message, type);
    return;
  }
  alert(message);
}

if (togglePasswordBtn && passwordInput) {
  togglePasswordBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePasswordBtn.textContent = isPassword ? "Hide" : "Show";
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const emailValue = (document.getElementById("email")?.value || "").trim().toLowerCase();
    const passwordValue = document.getElementById("password")?.value || "";
    const rememberMe = !!document.getElementById("rememberMe")?.checked;

    if (!emailValue || !passwordValue) {
      notify("Please fill in both email and password.", "error");
      return;
    }

    const submitBtn = loginForm.querySelector('button[type="submit"]');

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Signing In...";
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ email: emailValue, password: passwordValue }),
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const token = payload?.token || "";
      if (!token) {
        throw new Error("No token received");
      }

      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      localStorage.setItem(
        "crisisMitraUser",
        JSON.stringify({
          name: "Admin",
          isLoggedIn: true,
          role: "admin",
          email: emailValue,
          rememberMe,
        })
      );

      notify("Admin login successful.", "success");
      setTimeout(() => {
        window.location.href = "./admin-dashboard.html";
      }, 400);
    } catch (err) {
      if (err?.name === "AbortError") {
        notify("Login request timed out. Check backend server.", "error");
      } else {
        notify("Login failed. Check admin API/server.", "error");
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign In";
      }
    }
  });
}
