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

  document.querySelectorAll(".faq-list details").forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      document.querySelectorAll(".faq-list details").forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });

  const form = document.querySelector("[data-waitlist]");
  if (!form) return;

  const input = form.querySelector('input[type="email"]');
  const message = form.querySelector("[data-message]");
  const invalidMessage = form.dataset.invalidMessage;
  const successMessage = form.dataset.successMessage;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    message.className = "form-message";

    if (!input.checkValidity()) {
      message.textContent = invalidMessage;
      message.classList.add("error");
      input.focus();
      return;
    }

    // Preview behavior only. Replace this with a real waitlist endpoint before launch.
    message.textContent = successMessage;
    message.classList.add("success");
    form.reset();
  });
})();
