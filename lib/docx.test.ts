import { describe, it, expect } from "vitest";
import { strToU8, zipSync } from "fflate";
import { DOMParser } from "@xmldom/xmldom";
import { IMAGE_URL_PREFIX, ommlToLatex, readDocx } from "./docx";
import { parseQuestionPaper } from "./question-import";

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';

const p = (inner: string, numId?: number, ilvl = 0) =>
  `<w:p>${numId ? `<w:pPr><w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>` : ""}${inner}</w:p>`;
const r = (text: string, vert?: string) =>
  `<w:r>${vert ? `<w:rPr><w:vertAlign w:val="${vert}"/></w:rPr>` : ""}<w:t xml:space="preserve">${text}</w:t></w:r>`;
const mr = (t: string) => `<m:r><m:t>${t}</m:t></m:r>`;
const math = (inner: string) => `<m:oMath>${inner}</m:oMath>`;
const tc = (text: string) => `<w:tc>${p(r(text))}</w:tc>`;
const tr = (...cells: string[]) => `<w:tr>${cells.map(tc).join("")}</w:tr>`;

const NUMBERING = `<?xml version="1.0"?><w:numbering ${NS}>
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="(%2)"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

function docx(body: string, extra: Record<string, Uint8Array> = {}, rels = "") {
  return zipSync({
    "word/document.xml": strToU8(`<?xml version="1.0"?><w:document ${NS}><w:body>${body}</w:body></w:document>`),
    "word/numbering.xml": strToU8(NUMBERING),
    "word/_rels/document.xml.rels": strToU8(
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`
    ),
    ...extra,
  });
}

function latex(inner: string) {
  const doc = new DOMParser().parseFromString(`<m:oMath ${NS}>${inner}</m:oMath>`, "text/xml");
  return ommlToLatex(doc.documentElement as unknown as Element);
}

describe("ommlToLatex", () => {
  it("converts fractions, powers and roots", () => {
    expect(latex(`<m:f><m:num>${mr("u")}</m:num><m:den>${mr("2g")}</m:den></m:f>`)).toBe("\\frac{u}{2g}");
    expect(latex(`<m:sSup><m:e>${mr("x")}</m:e><m:sup>${mr("2")}</m:sup></m:sSup>`)).toBe("x^{2}");
    expect(latex(`<m:sSub><m:e>${mr("v")}</m:e><m:sub>${mr("0")}</m:sub></m:sSub>`)).toBe("v_{0}");
    expect(latex(`<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${mr("2")}</m:e></m:rad>`)).toBe("\\sqrt{2}");
    expect(latex(`<m:rad><m:deg>${mr("3")}</m:deg><m:e>${mr("x")}</m:e></m:rad>`)).toBe("\\sqrt[3]{x}");
  });

  it("converts brackets, sums, functions and accents", () => {
    expect(latex(`<m:d><m:e>${mr("a+b")}</m:e></m:d>`)).toBe("\\left(a+b\\right)");
    expect(latex(`<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val=""/></m:dPr><m:e>${mr("x")}</m:e></m:d>`)).toBe(
      "\\left\\{x\\right."
    );
    expect(
      latex(`<m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:sub>${mr("i=1")}</m:sub><m:sup>${mr("n")}</m:sup><m:e>${mr("i")}</m:e></m:nary>`)
    ).toBe("\\sum_{i=1}^{n} i");
    expect(latex(`<m:func><m:fName>${mr("sin")}</m:fName><m:e>${mr("θ")}</m:e></m:func>`)).toBe("\\sin \\theta");
    expect(latex(`<m:acc><m:accPr><m:chr m:val="⃗"/></m:accPr><m:e>${mr("F")}</m:e></m:acc>`)).toBe("\\vec{F}");
  });

  it("writes Greek letters and symbols as commands", () =>
    expect(latex(mr("α×β≤π"))).toBe("\\alpha \\times \\beta \\le \\pi"));
});

describe("readDocx", () => {
  it("writes out automatic numbering for questions and options", () => {
    const { text } = readDocx(
      docx(
        p(r("Find the height."), 1) +
          p(r("u"), 1, 1) +
          p(r("2u"), 1, 1) +
          p(r("Next question"), 1) +
          p(r("x"), 1, 1)
      )
    );
    expect(text).toBe("1. Find the height.\n(a) u\n(b) 2u\n2. Next question\n(a) x");
  });

  it("turns equations and super/subscripts into LaTeX", () => {
    const { text } = readDocx(
      docx(
        p(r("Height is ") + math(`<m:f><m:num>${mr("u")}</m:num><m:den>${mr("g")}</m:den></m:f>`)) +
          p(r("H") + r("2", "subscript") + r("O costs $5, x") + r("2", "superscript"))
      )
    );
    expect(text).toBe("Height is $\\frac{u}{g}$\nH${}_{2}$O costs \\$5, x${}^{2}$");
  });

  it("reads options laid out in a table as option lines", () => {
    const { text } = readDocx(docx(p(r("1. Pick")) + `<w:tbl>${tr("(a) one", "(b) two")}${tr("(c) three", "(d) four")}</w:tbl>`));
    expect(text).toBe("1. Pick\n(a) one\n(b) two\n(c) three\n(d) four");
  });

  it("keeps a match-the-lists table as a table", () => {
    const { text } = readDocx(docx(`<w:tbl>${tr("List-I", "List-II")}${tr("(P) Speed", "(1) m/s")}</w:tbl>`));
    expect(text).toBe("| List-I | List-II |\n| (P) Speed | (1) m/s |");
  });

  it("reads a paper typed into a table, number in the first column", () => {
    const { text } = readDocx(
      docx(`<w:tbl>${tr("1.", "First question")}${tr("", "(a) x (b) y (c) z")}${tr("2.", "Second question")}${tr("3.", "Third")}</w:tbl>`)
    );
    expect(text).toBe("1. First question\n(a) x (b) y (c) z\n2. Second question\n3. Third");
  });

  it("collects pictures with a placeholder where each sits", () => {
    const png = new Uint8Array([137, 80, 78, 71]);
    const drawing = `<w:r><w:drawing><wp:inline><a:graphic><a:graphicData><a:blip r:embed="rId5"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    const { text, images } = readDocx(
      docx(p(r("See ") + drawing), { "word/media/image1.png": png }, `<Relationship Id="rId5" Target="media/image1.png"/>`)
    );
    expect(text).toBe(`See ![](${IMAGE_URL_PREFIX}img1)`);
    expect(images).toEqual([{ id: "img1", name: "image1.png", contentType: "image/png", data: png }]);
  });

  it("explains a file that is not a .docx", () => {
    expect(() => readDocx(new Uint8Array([1, 2, 3]))).toThrow(/not a Word file/);
  });

  it("produces a paper the question reader accepts", () => {
    const { text } = readDocx(
      docx(
        `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${r("Physics")}</w:p>` +
          p(r("A ball is thrown up with speed ") + math(mr("u")) + r(". Maximum height?"), 1) +
          p(math(`<m:f><m:num>${mr("u")}</m:num><m:den>${mr("g")}</m:den></m:f>`), 1, 1) +
          p(math(`<m:f><m:num><m:sSup><m:e>${mr("u")}</m:e><m:sup>${mr("2")}</m:sup></m:sSup></m:num><m:den>${mr("2g")}</m:den></m:f>`), 1, 1) +
          p(r("Distance in 3 s?"), 1) +
          p(r("Answer key")) +
          p(r("1. B   2. 9"))
      )
    );
    const paper = parseQuestionPaper(text);
    expect(paper.errors).toEqual([]);
    expect(paper.sections[0].title).toBe("Physics");
    const [q1, q2] = paper.sections[0].questions;
    expect(q1.options.map((o) => o.text)).toEqual(["$\\frac{u}{g}$", "$\\frac{u^{2}}{2g}$"]);
    expect(q1.key).toEqual({ type: "SINGLE", options: ["B"] });
    expect(q2.key).toEqual({ type: "INTEGER", values: [9] });
  });
});
