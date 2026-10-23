(() => {
  const root = document.documentElement;
  const themeClasses = Array.from(document.querySelectorAll(".ui-light, .ui-dark"));
  const themeImagesSelector = "[data-ih-light][data-ih-dark]";
  const storageKey = "interviewhacker-theme";

  function applyTheme(theme, persist = false) {
    const isDark = theme === "dark";
    root.dataset.theme = isDark ? "dark" : "light";

    for (const node of themeClasses) {
      node.classList.toggle("ui-dark", isDark);
      node.classList.toggle("ui-light", !isDark);
    }

    for (const image of document.querySelectorAll(themeImagesSelector)) {
      const next = isDark ? image.dataset.ihDark : image.dataset.ihLight;
      if (next && image.getAttribute("src") !== next) {
        image.setAttribute("src", next);
      }
    }

    for (const toggle of document.querySelectorAll("[data-theme-toggle]")) {
      const toggleLabel = toggle.querySelector("[data-theme-label]");
      if (toggleLabel) {
        toggleLabel.textContent = isDark ? "浅色模式" : "深色模式";
      } else {
        toggle.textContent = isDark ? "浅色模式" : "深色模式";
      }
      toggle.setAttribute("aria-label", isDark ? "切换浅色模式" : "切换深色模式");
      toggle.setAttribute("aria-pressed", String(isDark));
    }

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute("content", isDark ? "#0f1115" : "#ffffff");
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

  document.addEventListener("click", event => {
    const toggle = event.target instanceof Element ? event.target.closest("[data-theme-toggle]") : null;
    if (toggle) {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
    }
  });

  if (document.body && "MutationObserver" in window) {
    const observer = new MutationObserver(records => {
      const hasThemeElements = records.some(record => [...record.addedNodes].some(node => {
        if (!(node instanceof Element)) return false;
        return node.matches("[data-theme-toggle], [data-ih-light][data-ih-dark]")
          || !!node.querySelector("[data-theme-toggle], [data-ih-light][data-ih-dark]");
      }));
      if (hasThemeElements) applyTheme(root.dataset.theme);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
