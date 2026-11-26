(() => {
  const menuButton = document.querySelector(".menu-button");
  const mobileNav = document.querySelector(".mobile-nav");

  const languageSwitch = document.querySelector("[data-language-switch]");
  if (languageSwitch) {
    const languageLinks = document.querySelectorAll("[data-language-link]");
    const preserveSection = () => {
      for (const link of languageLinks) link.hash = location.hash;
    };
    preserveSection();
    window.addEventListener("hashchange", preserveSection);
    document.addEventListener("click", (event) => {
      if (!languageSwitch.contains(event.target)) languageSwitch.open = false;
    });
    languageSwitch.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !languageSwitch.open) return;
      languageSwitch.open = false;
      languageSwitch.querySelector("summary").focus();
    });
  }

  if (menuButton && mobileNav) {
    const closeMenu = () => {
      mobileNav.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", menuButton.dataset.menuOpen);
    };

    menuButton.addEventListener("click", () => {
      const open = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(open));
      mobileNav.classList.toggle("open", open);
      menuButton.setAttribute("aria-label", open ? menuButton.dataset.menuClose : menuButton.dataset.menuOpen);
    });

    mobileNav.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 1060) closeMenu();
    });
  }

  const product = document.querySelector("[data-product-view]");
  if (product) {
    const panels = [...product.querySelectorAll("[data-product-panel]")];
    const tabs = [...product.querySelectorAll("[data-product-tab]")];
    const showPanel = () => {
      const hash = location.hash.slice(1);
      const active = panels.some((panel) => panel.dataset.productPanel === hash) ? hash : "features";
      for (const panel of panels) panel.hidden = panel.dataset.productPanel !== active;
      for (const tab of tabs) {
        if (tab.dataset.productTab === active) tab.setAttribute("aria-current", "location");
        else tab.removeAttribute("aria-current");
      }
      if (hash) window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", showPanel);
    showPanel();
  }
  document.querySelectorAll(".faq-list details").forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      document.querySelectorAll(".faq-list details").forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });

  const waitlistForm = document.querySelector("[data-waitlist]");
  if (waitlistForm) {
    // Retained only as a no-op guard for stale cached pages. New pages do not ship a waitlist form.
    waitlistForm.addEventListener("submit", (event) => event.preventDefault());
  }
})();
