import { describe, expect, test } from "bun:test";
import { handleRequest } from "./server";

const path = "/research/localizing-memorization";
const source = await Bun.file(new URL("./articles/localizing-memorization.html", import.meta.url)).text();
const request = (suffix = "", method = "GET") => handleRequest(new Request(`http://localhost${path}${suffix}`, { method }));

async function texts(html: string, selector: string) {
  const values: string[] = [];
  await new HTMLRewriter().on(selector, {
    element() { values.push(""); },
    text(chunk) { values[values.length - 1] += chunk.text; },
  }).transform(new Response(html)).text();
  return values.map(value => value.replace(/\s+/g, " ").trim());
}

describe("Localizing memorization article", () => {
  test.each(["", "/", "/?ref=research"])("renders the report at its route%s with progressive navigation", async suffix => {
    const response = request(suffix);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain('<article class="research-article" aria-labelledby="article-title">');
    expect(html).toContain('<title>Localizing latent mechanisms in weight space by spiking the training data — Project Spica</title>');
    expect(html).toContain('name="description" content="Localizing latent mechanisms');
    expect(html).toContain('href="/research" aria-current="location"');
    expect(html.match(/aria-current=/g)).toHaveLength(1);
    expect(await texts(html, "h1")).toEqual(["Localizing latent mechanisms in weight space by spiking the training data"]);
    expect(html).not.toContain('id="mission"');
    expect(html).toContain('src="/navigation.js"');
    expect(html).toContain(`data-page="${path}"`);
    expect(html).toContain('class="mosaic-hero"');
    expect(html).toContain('src="/theme.js"');
    expect(html).toContain('src="/constellation.js"');
    expect(html).toContain('<a href="/research/localizing-memorization.pdf">Download PDF</a>');
    expect(html).not.toContain('Back to Research');
    expect(html).toContain(source);
    expect(request(suffix, "HEAD").status).toBe(200);
    expect(await request(suffix, "HEAD").text()).toBe("");
  });

  test("serves the self-hosted math font and its redistribution license", async () => {
    const font = handleRequest(new Request("http://localhost/fonts/stix-two-math.woff2"));
    expect(font.status).toBe(200);
    expect(font.headers.get("Content-Type")).toContain("font/woff2");
    expect(Buffer.from(await font.arrayBuffer()).toString("ascii", 0, 4)).toBe("wOF2");
    const license = handleRequest(new Request("http://localhost/fonts/stix-two-OFL.txt"));
    expect(license.status).toBe(200);
    expect(await license.text()).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });

  test("does not expose the source article or invent other research routes", () => {
    for (const url of ["/_source/articles/localizing-memorization.html", "/articles/localizing-memorization.html", "/research/missing/"]) {
      expect(handleRequest(new Request(`http://localhost${url}`)).status).toBe(404);
    }
    expect(request("/", "POST").status).toBe(405);
  });

  test("tracks the source PDF revision used for the transcription", async () => {
    const pdf = await Bun.file(new URL("./public/research/localizing-memorization.pdf", import.meta.url)).arrayBuffer();
    // Changing the PDF requires reviewing the HTML transcription as well.
    expect(new Bun.CryptoHasher("sha256").update(pdf).digest("hex"))
      .toBe("088b3de78af114d98d1dd6472ce28cd895afe46eb33c58b1440b6a65d5c5dc30");
  });

  test("preserves the title, byline, date, all sections and experimental details", async () => {
    expect(await texts(source, "h2")).toEqual([
      "1 Introduction", "2 Influence functions on spiked data", "3 Computing the inverse Hessian product",
      "4 Case study on Hubble", "5 Next steps", "References",
    ]);
    expect(await texts(source, ".article-authors")).toEqual(["Johnny, Gustavo, Jerry, Yanai, Robin"]);
    expect(source).toContain('<time datetime="2026-09">September 2026</time>');
    expect(source).toContain("validation examples are used select the step size");
    expect(source).toContain("Wikipedia is a corpus of book passages and is not a test set");
    expect(await texts(source, 'section[aria-labelledby="hubble"] > ol > li')).toEqual([
      "The step size is chosen on the validation set. It is the step that best minimizes the accuracy difference between members and non-members.",
      "Fisher diagonals are calculated on gradients from non-members and members. K-FAC are trained on data from non-members.",
      "The influence function methods only consider MLP layers, which accounts for 25% of the parameters.",
    ]);
    expect(source).toContain("the latent mechanism needs to be described in terms of a contrast.");
    expect(source).not.toMatch(/<iframe|<canvas|<img|\{\{/);
  });

  test("retains all twelve equations as native MathML, including the boxed result and underbraces", async () => {
    expect(source.match(/<math[^>]* display="block"/g)).toHaveLength(12);
    for (let n = 1; n <= 12; n++) {
      expect(source).toContain(`id="equation-${n}" role="group" aria-label="Equation ${n}" tabindex="0"`);
      expect(source).toContain(`href="#equation-${n}" aria-label="Equation ${n}">(${n})</a>`);
    }
    expect(source).toContain('class="equation boxed-equation" id="equation-7"');
    expect(await texts(source, "#equation-1 math")).toEqual(["M(θ)=L0(θ)−L1(θ)"]);
    expect(await texts(source, "#equation-8 math")).toEqual(["θsup=θ^−ηΔθ"]);
    expect(await texts(source, "#equation-10 math")).toEqual(["FW≈𝔼[aa⊤]⊗𝔼[bb⊤],"]);
    expect(await texts(source, "#equation-11 math")).toEqual(["AΔθ=v"]);
    expect(source).toContain("<mtext>vector</mtext>");
    expect(source).toContain("<mtext>scalar</mtext>");
  });

  // Independent transcription of every data cell from PDF pages 5–7.
  test("preserves every table row and its numeric precision", async () => {
    const rows = async (n: number) => {
      const cells = await texts(source, `#table-${n} tbody th, #table-${n} tbody td`);
      const width = [4, 6, 5, 5, 4][n - 1];
      return Array.from({ length: cells.length / width }, (_, i) => cells.slice(i * width, (i + 1) * width).join(" | "));
    };
    expect(await rows(1)).toEqual([
      "0 | 1,600 / 400 / 2,000 | 1,600 / 400 / 2,000 | 1,600 / 400 / 2,000",
      "1 | 571 / 143 / 715 | 571 / 143 / 715 | 571 / 143 / 715",
      "4 | 571 / 143 / 715 | 571 / 143 / 715 | 571 / 143 / 715",
      "16 | 286 / 71 / 357 | 286 / 71 / 357 | 286 / 71 / 357",
      "64 | 114 / 29 / 143 | 114 / 29 / 143 | 114 / 29 / 143",
      "256 | 58 / 14 / 71 | 58 / 14 / 71 | 58 / 14 / 71",
      "Total | 3,200 / 800 / 4,001 | 3,200 / 800 / 4,001 | 3,200 / 800 / 4,001",
    ]);
    expect(await rows(2)).toEqual([
      "η | — | 0 | 0.01 | 0.01 | 0.01",
      "0 | 79.7 / 100.0 | 78.7 / 88.4 | 51.8 / 63.9 | 78.0 / 93.8 | 85.5 / 95.2",
      "1 | 82.0 / 100.0 | 82.5 / 90.5 | 53.6 / 64.6 | 81.5 / 93.7 | 77.6 / 93.7",
      "4 | 81.4 / 100.0 | 84.2 / 88.8 | 57.9 / 65.6 | 80.7 / 93.7 | 80.4 / 91.6",
      "16 | 81.2 / 100.0 | 93.8 / 85.7 | 53.2 / 65.3 | 82.6 / 91.9 | 94.4 / 93.0",
      "64 | 80.4 / 100.0 | 100.0 / 80.4 | 46.9 / 59.4 | 88.1 / 90.9 | 86.2 / 93.1",
      "256 | 77.5 / 100.0 | 100.0 / 77.5 | 53.5 / 70.4 | 83.1 / 94.4 | 92.9 / 92.9",
      "All | 80.4 / 100.0 | 89.9 / 85.2 | 52.8 / 64.9 | 82.3 / 93.1 | 86.2 / 93.2",
    ]);
    expect(await rows(3)).toEqual([
      "0 | 50.9 | — | 78.2 | —", "0.005 | 52.0 | +1.1 | 79.7 | +1.5",
      "0.010 | 51.0 | +0.1 | 77.3 | −0.9", "0.030 | 41.9 | −9.0 | 58.9 | −19.3",
    ]);
    expect(await rows(4)).toEqual([
      "1 | 0.571 | 0.564 | 0.572 | 0.582", "4 | 0.659 | 0.655 | 0.730 | 0.711",
      "16 | 0.891 | 0.882 | 0.932 | 0.933", "64 | 1.000 | 1.000 | 0.991 | 1.000",
      "256 | 1.000 | 1.000 | 0.990 | 1.000", "All | 0.824 | 0.820 | 0.843 | 0.845",
    ]);
    expect(await rows(5)).toEqual([
      "Target (standard) | 80.4 / 100.0 | 61.4 / 100.0 | 83.7 / 100.0",
      "No edit (perturbed) | 89.9 / 85.2 | 78.6 / 76.4 | 90.5 / 81.8",
      "PIQA | 84.3 / 92.5 | 65.4 / 91.5 | 88.2 / 85.4",
      "HellaSwag | 84.3 / 92.1 | 64.9 / 91.9 | 87.5 / 85.3",
      "WinoGrande | 84.0 / 92.3 | 62.0 / 91.8 | 85.5 / 88.3",
      "Wikipedia | 84.1 / 92.2 | 63.7 / 91.8 | 86.9 / 86.3",
    ]);
    expect(await texts(source, "#table-5 td strong")).toEqual(["92.5", "91.9", "88.3"]);
    expect(await texts(source, "#table-3 .reported-row th")).toEqual(["0.010"]);
    expect(source.match(/class="table-scroll" role="region"/g)).toHaveLength(5);
    expect(source.match(/<figcaption id="table-\d-caption">Table \d:/g)).toHaveLength(5);
  });

  test("retains all 22 references and resolves every citation and equation anchor", async () => {
    expect(source.match(/<li id="reference-/g)).toHaveLength(22);
    for (let n = 1; n <= 22; n++) {
      expect(source).toContain(`id="reference-${n}"`);
      expect(source).toContain(`href="#reference-${n}"`);
    }
    const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [, id] of source.matchAll(/href="#([^"]+)"/g)) expect(ids).toContain(id);
    expect(source).toContain("isbn:</span> 9780691120348");
    expect(source).toContain("(visited on 09/26/2024)");
    expect(source).toContain("doi:</span> 10.52202/075280-1708");
    expect(source).toContain("Identifier=UC11399NX73&amp;SourceAction=API_VIEW_DETAILS_TRX&amp;UsePreviewPdf=False");
    expect(await texts(source, "#reference-22")).toEqual([
      "Chiyuan Zhang et al. “Counterfactual Memorization in Neural Language Models”. In: Advances in Neural Information Processing Systems. Ed. by A. Oh et al. Vol. 36. Curran Associates, Inc., 2023, pp. 39321–39362. doi: 10.52202/075280-1708. url: https://proceedings.neurips.cc/paper_files/paper/2023/file/7bc4f74e35bcfe8cfe43b0a860786d6a-Paper-Conference.pdf.",
    ]);
  });
});
