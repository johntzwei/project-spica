const navigationLinks = [...document.querySelectorAll(".section-nav a")];
const pages = [...document.querySelectorAll("#main > section")];
const main = document.querySelector("#main");

function showPage(moveFocus = false, scrollTop = 0) {
  const requestedPage = window.location.pathname.replace(/\/index\.html$/, "/").replace(/^\/|\/$/g, "");
  const activePage = pages.find(page => page.id === requestedPage) ?? pages[0];

  for (const page of pages) {
    page.hidden = page !== activePage;
  }

  for (const link of navigationLinks) {
    const active = new URL(link.href).pathname.replace(/\/$/, "") === `/${activePage.id}`;
    if (active) {
      link.setAttribute("aria-current", "page");
      document.title = `${link.textContent.trim()} — Project Spica`;
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.href = `https://projectspica.org/${activePage.id}/`;
    } else {
      link.removeAttribute("aria-current");
    }
  }

  if (moveFocus) {
    main.focus({ preventScroll: true });
    window.scrollTo({ top: scrollTop, behavior: "instant" });
  }
}

for (const link of navigationLinks) {
  link.addEventListener("click", event => {
    // Preserve opening links in another tab/window with modifier keys.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (link.getAttribute("aria-current") === "page") return;
    // Capture before changing sections, since shorter pages can clamp scrolling.
    const scrollTop = window.scrollY;
    window.history.pushState(null, "", link.href);
    showPage(true, scrollTop);
  });
}

window.addEventListener("popstate", () => showPage(true));
showPage();
