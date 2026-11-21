(() => {
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
  if (document.body.classList.contains("site-short")) {
    const followOldLink = () => {
      const hash = location.hash.slice(1);
      if (hash === "faq" || hash === "pricing") location.replace(hash + "/");
      else if (["features", "daily", "decisions", "how"].includes(hash)) location.replace("product/#" + hash);
    };
    window.addEventListener("hashchange", followOldLink);
    followOldLink();
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
