import { describe, expect, test } from "bun:test";
import { runInNewContext } from "node:vm";

const source = await Bun.file(new URL("./public/navigation.js", import.meta.url)).text();

// Exercise the actual navigation script with an isolated DOM/history interface.
function browser(path: string, trailingSlash = false) {
  const pages = ["mission", "roadmap", "research", "people"].map(id => ({ id, hidden: false }));
  const links = pages.map((page, i) => {
    const href = `http://localhost/${page.id}${trailingSlash ? "/" : ""}`;
    const attributes = new Map([["href", new URL(href).pathname]]);
    return {
      href,
      textContent: ["Mission", "Roadmap", "Research", "People"][i],
      click: (_event: any) => {},
      getAttribute: (name: string) => attributes.get(name),
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
      addEventListener(_name: string, handler: (event: any) => void) { this.click = handler; },
    };
  });
  let focusCount = 0;
  let scrollCount = 0;
  const history = [path];
  let cursor = 0;
  let popstate = () => {};
  const window = {
    location: new URL(path, "http://localhost"),
    history: {
      pushState(_state: unknown, _title: string, href: string) {
        window.location = new URL(href);
        history.splice(++cursor, history.length, window.location.pathname);
      },
    },
    scrollY: 0,
    scrollTo({ top }: { top: number }) {
      scrollCount++;
      window.scrollY = top;
    },
    addEventListener(_name: string, handler: () => void) { popstate = handler; },
  };
  const document = {
    title: "",
    querySelectorAll: (selector: string) => selector === ".section-nav a" ? links : pages,
    querySelector: (selector: string) => selector === "#main" ? { focus() { focusCount++; } } : null,
  };
  runInNewContext(source, { window, document, URL });
  return {
    pages, links, window, document, history,
    get focusCount() { return focusCount; },
    get scrollCount() { return scrollCount; },
    click(index: number, modifiers = {}) {
      let prevented = false;
      links[index].click({ button: 0, preventDefault() { prevented = true; }, ...modifiers });
      return prevented;
    },
    go(delta: number) {
      cursor += delta;
      window.location = new URL(history[cursor], "http://localhost");
      popstate();
    },
  };
}

function expectPage(page: ReturnType<typeof browser>, id: string, label: string) {
  expect(page.pages.filter(section => !section.hidden).map(section => section.id)).toEqual([id]);
  expect(page.links.filter(link => link.getAttribute("aria-current") === "page").map(link => link.textContent)).toEqual([label]);
  expect(page.document.title).toBe(`${label} — Project Spica`);
}

describe("path-based navigation", () => {
  test.each([
    ["/", "mission", "Mission"],
    ["/mission", "mission", "Mission"],
    ["/roadmap", "roadmap", "Roadmap"],
    ["/research", "research", "Research"],
    ["/people", "people", "People"],
    ["/mission/", "mission", "Mission"],
    ["/roadmap/", "roadmap", "Roadmap"],
    ["/research/", "research", "Research"],
    ["/people/", "people", "People"],
    ["/people/index.html", "people", "People"],
    ["/research/index.html", "research", "Research"],
  ])("initializes %s without moving focus or scrolling", (path, id, label) => {
    const page = browser(path);
    expectPage(page, id, label);
    expect(page.focusCount).toBe(0);
    expect(page.scrollCount).toBe(0);
  });

  test.each([
    ["mission", "roadmap", 1],
    ["mission", "research", 2],
    ["roadmap", "mission", 0],
    ["roadmap", "research", 2],
    ["research", "mission", 0],
    ["research", "roadmap", 1],
    ["mission", "people", 3],
    ["people", "mission", 0],
    ["research", "people", 3],
    ["people", "research", 2],
  ] as const)("preserves scroll when navigating from %s to %s", (from, to, index) => {
    const page = browser(`/${from}`);
    page.window.scrollY = 240;
    expect(page.click(index)).toBe(true);
    expect(page.window.location.pathname).toBe(`/${to}`);
    expect(page.window.scrollY).toBe(240);
    expect(page.focusCount).toBe(1);
    expect(page.scrollCount).toBe(1);
  });

  test("supports GitHub Pages directory links and Back/Forward", () => {
    const page = browser("/mission/", true);
    expectPage(page, "mission", "Mission");
    page.click(3);
    expect(page.window.location.pathname).toBe("/people/");
    expectPage(page, "people", "People");
    page.go(-1);
    expectPage(page, "mission", "Mission");
    page.go(1);
    expectPage(page, "people", "People");
  });

  test("Back/Forward still resets scrolling to the top", () => {
    const page = browser("/mission");
    page.window.scrollY = 240;
    page.click(1);
    page.go(-1);
    expect(page.window.scrollY).toBe(0);
    page.window.scrollY = 120;
    page.go(1);
    expect(page.window.scrollY).toBe(0);
  });

  test("switches pages and handles Back/Forward with focus and scroll updates", () => {
    const page = browser("/mission");
    expect(page.click(1)).toBe(true);
    expect(page.window.location.pathname).toBe("/roadmap");
    expectPage(page, "roadmap", "Roadmap");
    page.click(2);
    expectPage(page, "research", "Research");
    page.go(-1);
    expectPage(page, "roadmap", "Roadmap");
    page.go(1);
    expectPage(page, "research", "Research");
    expect(page.focusCount).toBe(4);
    expect(page.scrollCount).toBe(4);
    page.click(2);
    expect(page.history).toEqual(["/mission", "/roadmap", "/research"]);
    expect(page.focusCount).toBe(4);
  });

  test("navigates to People and restores it with Back/Forward", () => {
    const page = browser("/mission");
    expect(page.click(3)).toBe(true);
    expect(page.window.location.pathname).toBe("/people");
    expectPage(page, "people", "People");
    page.go(-1);
    expectPage(page, "mission", "Mission");
    page.go(1);
    expectPage(page, "people", "People");
  });

  test("leaves modified and middle clicks to the browser", () => {
    const page = browser("/mission");
    for (const modifiers of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      expect(page.click(1, modifiers)).toBe(false);
    }
    expect(page.history).toEqual(["/mission"]);
    expectPage(page, "mission", "Mission");
  });
});
