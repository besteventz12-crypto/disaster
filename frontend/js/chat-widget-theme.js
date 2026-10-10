(function () {
  const AVATAR_SRC = "./Material/logo.png";
  const STYLE_ID = "resqlink-chat-widget-theme";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #noupe-chat-widget .resqlink-input,
      .noupe-widget-container .resqlink-input,
      #noupe-chat-widget input[placeholder*="Ask AI"],
      .noupe-widget-container input[placeholder*="Ask AI"] {
        border-radius: 16px !important;
        border: 1px solid rgba(59, 130, 246, 0.35) !important;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.35) !important;
        background: #f8fafc !important;
        color: #0f172a !important;
        font-weight: 500 !important;
      }

      #noupe-chat-widget button.resqlink-send,
      .noupe-widget-container button.resqlink-send,
      #noupe-chat-widget button[aria-label*="send" i],
      .noupe-widget-container button[aria-label*="send" i] {
        background: linear-gradient(135deg, #2563eb, #0ea5e9) !important;
        color: #ffffff !important;
        border-radius: 999px !important;
        box-shadow: 0 8px 18px rgba(37, 99, 235, 0.45) !important;
      }

      #noupe-chat-widget img.resqlink-avatar,
      .noupe-widget-container img.resqlink-avatar {
        width: 40px !important;
        height: 40px !important;
        border-radius: 999px !important;
        object-fit: cover !important;
        border: 2px solid rgba(255, 255, 255, 0.9) !important;
        box-shadow: 0 6px 14px rgba(2, 6, 23, 0.35) !important;
      }
    `;

    document.head.appendChild(style);
  }

  function applyTheme() {
    const widget = document.querySelector("#noupe-chat-widget, .noupe-widget-container");
    if (!widget) return;

    const askInput = widget.querySelector('input[placeholder*="Ask AI"]');
    if (askInput) {
      askInput.classList.add("resqlink-input");
    }

    const sendButton = widget.querySelector('button[aria-label*="send" i], button[type="submit"]');
    if (sendButton) {
      sendButton.classList.add("resqlink-send");
    }

    const avatarImg = widget.querySelector("img");
    if (avatarImg) {
      avatarImg.classList.add("resqlink-avatar");
      if (avatarImg.getAttribute("src") !== AVATAR_SRC) {
        avatarImg.setAttribute("src", AVATAR_SRC);
        avatarImg.removeAttribute("srcset");
      }
      avatarImg.setAttribute("alt", "ResQlink AI");
    }
  }

  function init() {
    injectStyles();
    applyTheme();

    const observer = new MutationObserver(() => {
      applyTheme();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
    });

    setInterval(applyTheme, 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
