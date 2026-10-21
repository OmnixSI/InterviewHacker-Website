(() => {
  const root = document.documentElement;
  const themeClasses = Array.from(document.querySelectorAll(".ui-light, .ui-dark"));
  const themeImages = Array.from(document.querySelectorAll("[data-ih-light][data-ih-dark]"));
  const toggle = document.querySelector("[data-theme-toggle]");
  const toggleLabel = toggle?.querySelector("[data-theme-label]");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const storageKey = "interviewhacker-theme";

  function applyTheme(theme, persist = false) {
    const isDark = theme === "dark";
    root.dataset.theme = isDark ? "dark" : "light";

    for (const node of themeClasses) {
      node.classList.toggle("ui-dark", isDark);
      node.classList.toggle("ui-light", !isDark);
    }

    for (const image of themeImages) {
      const next = isDark ? image.dataset.ihDark : image.dataset.ihLight;
      if (next && image.getAttribute("src") !== next) {
        image.setAttribute("src", next);
      }
    }

    if (toggle) {
      if (toggleLabel) {
        toggleLabel.textContent = isDark ? "浅色模式" : "深色模式";
      } else {
        toggle.textContent = isDark ? "浅色模式" : "深色模式";
      }
      toggle.setAttribute("aria-label", isDark ? "切换浅色模式" : "切换深色模式");
      toggle.setAttribute("aria-pressed", String(isDark));
    }

    if (themeMeta) {
      themeMeta.setAttribute("content", isDark ? "#0f1115" : "#f5f6f8");
    }

    if (persist) {
      try {
        localStorage.setItem(storageKey, isDark ? "dark" : "light");
      } catch {
        // The selected theme remains active for this page view.
      }
    }
  }

  const initialTheme = root.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(initialTheme);

  if (toggle) {
    toggle.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
    });
  }
})();
