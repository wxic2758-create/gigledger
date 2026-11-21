(() => {
  const menuButton = document.querySelector(".menu-button");
  const mobileNav = document.querySelector(".mobile-nav");

  if (menuButton && mobileNav) {
    const closeMenu = () => {
      mobileNav.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute(
        "aria-label",
        document.documentElement.lang === "en" ? "Open menu" : "開啟選單",
      );
    };

    menuButton.addEventListener("click", () => {
      const open = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(open));
      mobileNav.classList.toggle("open", open);
      menuButton.setAttribute(
        "aria-label",
        open
          ? document.documentElement.lang === "en"
            ? "Close menu"
            : "關閉選單"
          : document.documentElement.lang === "en"
            ? "Open menu"
            : "開啟選單",
      );
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
