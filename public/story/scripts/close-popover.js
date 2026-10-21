(() => {
  const popover = document.querySelector(".header .popover");
  const trigger = document.querySelector("#header-tips");
  const links = document.querySelectorAll(".header-popover-nav a[href^='#']");

  if (!popover || !trigger || !window.jQuery) return;

  window.jQuery(popover)
    .on("shown.popover", () => trigger.setAttribute("aria-expanded", "true"))
    .on("hidden.popover", () => trigger.setAttribute("aria-expanded", "false"));

  for (const link of links) {
    link.addEventListener("click", () => {
      window.jQuery(popover).popover("hide");
    });
  }
})();
