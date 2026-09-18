import { describe, expect, test } from "bun:test";
import { runInNewContext } from "node:vm";

const source = await Bun.file(new URL("./public/theme.js", import.meta.url)).text();

type Node = Record<string, any>;

// Exercise the real theme script against a minimal DOM and Web Audio interface.
function browser({ audio = true }: { audio?: boolean } = {}) {
  const root = { dataset: { theme: "dark" } };
  const attributes = new Map<string, Map<string, string>>();
  const element = (name: string): Node => {
    attributes.set(name, new Map());
    return {
      hidden: name === "toggle",
      setAttribute: (key: string, value: string) => attributes.get(name)!.set(key, value),
      getAttribute: (key: string) => attributes.get(name)!.get(key),
      decode: () => Promise.resolve(),
      addEventListener(_event: string, handler: () => void) { this.click = handler; },
      click: () => {},
    };
  };
  const toggle = element("toggle");
  const day = element("day");
  const night = element("night");
  const themeColor: Node = { content: "#050914" };
  const document = {
    documentElement: root,
    querySelector: (selector: string) => ({
      ".theme-toggle": toggle,
      ".mosaic-day": day,
      ".mosaic-night": night,
      'meta[name="theme-color"]': themeColor,
    })[selector] ?? null,
  };

  const nodes: Node[] = [];
  let resumed = 0;
  let contexts = 0;
  const param = () => {
    const events: [string, number, number][] = [];
    return {
      value: 0,
      events,
      setValueAtTime: (value: number, time: number) => events.push(["set", value, time]),
      exponentialRampToValueAtTime: (value: number, time: number) => events.push(["ramp", value, time]),
    };
  };
  const node = (type: string, extra: Node = {}): Node => {
    const created: Node = {
      type: "",
      kind: type,
      connectedTo: [] as Node[],
      connect(target: Node) { created.connectedTo.push(target); return target; },
      ...extra,
    };
    nodes.push(created);
    return created;
  };
  const voice = (kind: string, extra: Node = {}): Node => {
    const created = node(kind, { started: [] as number[], stopped: [] as number[], ...extra });
    created.start = (time: number) => created.started.push(time);
    created.stop = (time: number) => created.stopped.push(time);
    return created;
  };
  class AudioContext {
    sampleRate = 44100;
    currentTime = 0;
    destination = node("destination");
    constructor() { contexts++; }
    resume() { resumed++; }
    createBuffer(channels: number, length: number) {
      const data = new Float32Array(length);
      return { channels, length, getChannelData: () => data };
    }
    createGain() { return node("gain", { gain: param() }); }
    createBiquadFilter() { return node("filter", { frequency: param(), Q: param() }); }
    createBufferSource() { return voice("source", { buffer: null }); }
    createOscillator() { return voice("oscillator", { frequency: param() }); }
  }

  const window: Node = audio ? { AudioContext } : {};
  runInNewContext(source, { window, document, Math, Float32Array, Promise });
  return {
    root, toggle, day, night, themeColor, nodes,
    get contexts() { return contexts; },
    get resumed() { return resumed; },
    of: (kind: string) => nodes.filter(entry => entry.kind === kind),
    click: () => toggle.click(),
  };
}

describe("mosaic sun theme toggle", () => {
  test("switches the theme and plays one lever clack per click", () => {
    const page = browser();
    expect(page.nodes.filter(node => node.kind !== "destination")).toHaveLength(0);

    page.click();
    expect(page.root.dataset.theme).toBe("light");
    expect(page.toggle.getAttribute("aria-pressed")).toBe("false");
    expect(page.themeColor.content).toBe("#730f24");
    expect(page.contexts).toBe(1);
    expect(page.of("source")).toHaveLength(1);
    expect(page.of("oscillator")).toHaveLength(1);

    page.click();
    expect(page.root.dataset.theme).toBe("dark");
    // One shared context, reused rather than reopened on every click.
    expect(page.contexts).toBe(1);
    expect(page.resumed).toBe(2);
    expect(page.of("source")).toHaveLength(2);
  });

  test("keeps the clack short, quiet and routed to the speakers", () => {
    const page = browser();
    page.click();
    const [clack] = page.of("source");
    const [thock] = page.of("oscillator");
    const [master] = page.of("gain");
    expect(master.gain.value).toBe(0.3);
    expect(master.connectedTo).toEqual(page.of("destination"));
    expect(thock.type).toBe("triangle");
    expect(page.of("filter")[0].type).toBe("bandpass");
    // Minecraft's lever is a brief wooden tick, not a tone.
    for (const voice of [clack, thock]) {
      expect(voice.started).toEqual([0]);
      expect(voice.stopped[0]).toBeLessThanOrEqual(0.1);
    }
  });

  test("pitches the clack up when the sun switches on and down when it switches off", () => {
    const lit = browser();
    lit.click(); // dark -> light, the sun coming on
    const dimmed = browser();
    dimmed.root.dataset.theme = "light";
    dimmed.click(); // light -> dark, the sun going out

    const body = (page: ReturnType<typeof browser>) => page.of("filter")[0].frequency.value;
    const voice = (page: ReturnType<typeof browser>) => page.of("oscillator")[0].frequency.events[0][1];
    expect(body(lit) / body(dimmed)).toBeCloseTo(1.2, 5);
    expect(voice(lit) / voice(dimmed)).toBeCloseTo(1.2, 5);
    expect(body(dimmed)).toBe(1800);
    expect(voice(dimmed)).toBe(420);
  });

  test("still switches the theme where audio is unavailable", () => {
    const page = browser({ audio: false });
    page.click();
    expect(page.root.dataset.theme).toBe("light");
    expect(page.toggle.getAttribute("aria-label")).toBe("Switch to dark mode");
    expect(page.nodes.filter(node => node.kind !== "destination")).toHaveLength(0);
  });
});
