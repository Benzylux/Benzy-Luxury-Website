(function () {
  const STORAGE_KEY = "benzy_theme_preference";
  const root = document.documentElement;
  const media = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

  function normalizeTheme(value) {
    return value === "dark" || value === "light" ? value : "";
  }

  function readStoredTheme() {
    try {
      return normalizeTheme(localStorage.getItem(STORAGE_KEY));
    } catch {
      return "";
    }
  }

  function getResolvedTheme() {
    const storedTheme = readStoredTheme();
    if (storedTheme) return storedTheme;
    return media && media.matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    const nextTheme = normalizeTheme(theme) || "light";
    root.setAttribute("data-theme", nextTheme);
    root.style.colorScheme = nextTheme;
  }

  function persistTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage write failures and continue with the active theme.
    }
  }

  function clearStoredTheme() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
  }

  function syncToggle() {
    const buttons = document.querySelectorAll("[data-theme-toggle]");
    if (!buttons.length) return;

    const theme = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const nextTheme = theme === "dark" ? "light" : "dark";
    const isFollowingSystem = !readStoredTheme();

    buttons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.dataset.theme = theme;
      button.setAttribute("aria-pressed", String(theme === "dark"));
      button.setAttribute("aria-label", "Switch to " + nextTheme + " mode");
      button.title = isFollowingSystem
        ? "Following system theme. Click to lock " + nextTheme + " mode."
        : "Click to switch to " + nextTheme + " mode. Right-click to follow your device theme again.";
    });
  }

  function attachToggle(button, variant) {
    const navbars = document.querySelectorAll(".navbar");
    const navbar = navbars.length ? navbars[0] : null;

    if (navbar instanceof HTMLElement) {
      const navRight = navbar.querySelector(".nav-right");
      const navLinks = navbar.querySelector(".nav-links");

      if (variant === "mobile" && navLinks instanceof HTMLElement) {
        const item = document.createElement("li");
        item.className = "nav-theme-item";
        item.innerHTML = '<span class="nav-theme-label">Display mode</span>';
        item.appendChild(button);
        navLinks.appendChild(item);
      } else if (navRight instanceof HTMLElement) {
        navRight.insertBefore(button, navRight.firstChild);
      } else {
        button.classList.add("bl-theme-toggle--nav");
        navbar.appendChild(button);
      }
      return;
    }

    button.classList.add("bl-theme-toggle--floating");
    document.body.appendChild(button);
  }

  function createToggle(extraClass) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bl-theme-toggle" + (extraClass ? " " + extraClass : "");
    button.setAttribute("data-theme-toggle", "true");
    button.setAttribute("aria-live", "polite");

    button.innerHTML = [
      '<span class="bl-theme-toggle__track" aria-hidden="true">',
      '<span class="bl-theme-toggle__icon bl-theme-toggle__icon--sun">',
      '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M12 3.75V2m0 20v-1.75M4.93 4.93 3.7 3.7m16.6 16.6-1.23-1.23M3.75 12H2m20 0h-1.75M4.93 19.07 3.7 20.3m16.6-16.6-1.23 1.23M12 16.5A4.5 4.5 0 1 0 12 7.5a4.5 4.5 0 0 0 0 9Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7"/></svg>',
      "</span>",
      '<span class="bl-theme-toggle__icon bl-theme-toggle__icon--moon">',
      '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M20.2 14.1A8.6 8.6 0 0 1 9.9 3.8a8.9 8.9 0 1 0 10.3 10.3Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7"/></svg>',
      "</span>",
      '<span class="bl-theme-toggle__thumb"></span>',
      "</span>"
    ].join("");

    button.addEventListener("click", function () {
      const nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      persistTheme(nextTheme);
      applyTheme(nextTheme);
      syncToggle();
    });

    button.addEventListener("contextmenu", function (event) {
      event.preventDefault();
      clearStoredTheme();
      applyTheme(getResolvedTheme());
      syncToggle();
    });

    return button;
  }

  function buildToggle() {
    if (!document.body || document.querySelector("[data-theme-toggle]")) return;

    const desktopToggle = createToggle("bl-theme-toggle--desktop");
    attachToggle(desktopToggle, "desktop");

    const mobileToggle = createToggle("bl-theme-toggle--mobile");
    attachToggle(mobileToggle, "mobile");

    syncToggle();
  }

  function handleSystemThemeChange() {
    if (readStoredTheme()) return;
    applyTheme(getResolvedTheme());
    syncToggle();
  }

  applyTheme(getResolvedTheme());

  if (media) {
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleSystemThemeChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(handleSystemThemeChange);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildToggle, { once: true });
  } else {
    buildToggle();
  }
})();
