const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

const button = document.querySelector(".menu-button");
const menu = document.querySelector(".mobile-menu");
if (button && menu) {
  button.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  });
  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    menu.classList.remove("open");
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }));
}

const topButton = document.querySelector(".back-to-top");
if (topButton) {
  const toggle = () => topButton.classList.toggle("visible", window.scrollY > 420);
  toggle();
  window.addEventListener("scroll", toggle, { passive: true });
}
