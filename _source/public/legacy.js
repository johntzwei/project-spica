// Fragments never reach GitHub Pages. Resolve old bookmarks in the browser.
// Only these fixed destinations are accepted; URL parameters cannot redirect elsewhere.
(() => {
  const pages = new Set(["mission", "roadmap", "research", "people"]);
  const destinations = {
    about: "/mission/",
    approach: "/roadmap/",
    usecaseCarousel: "/roadmap/",
    activities: "https://projectspica.substack.com/",
    subscribe: "https://projectspica.substack.com/subscribe",
    people: "/people/",
  };

  function redirectLegacyBookmark() {
    const url = new URL(window.location.href);
    let destination;
    if (/^\/about\/?$/.test(url.pathname)) {
      destination = "/mission/";
    } else if (url.pathname === "/" || url.pathname === "/index.html") {
      const requested = url.searchParams.get("page");
      const page = requested === "about" ? "mission" : requested;
      if (pages.has(page)) {
        destination = `/${page}/`;
        url.searchParams.delete("page");
      } else if (Object.hasOwn(destinations, url.hash.slice(1))) {
        destination = destinations[url.hash.slice(1)];
        url.hash = "";
      }
    }
    if (!destination) return;
    const target = new URL(destination, url);
    // Keep campaign parameters on local links, but do not leak them to other sites.
    if (target.origin === url.origin) {
      target.search = url.search;
      target.hash = url.hash;
    }
    window.location.replace(target.href);
  }

  window.addEventListener("hashchange", redirectLegacyBookmark);
  redirectLegacyBookmark();
})();
