/**
 * Reads a Word (.docx) question paper into the plain-text paste format.
 *
 * The result is not saved directly: it lands in the paste box, where the
 * tutor sees the same preview and the same line-by-line problems as for
 * pasted text, fixes what needs fixing, and saves. So this only has to be a
 * faithful transcription, not a perfect one.
 *
 * What comes across:
 *   - paragraph text, with Word's automatic list numbering written out
 *     ("1.", "(a)"), so auto-numbered questions and options survive;
 *   - equations made with Word's equation editor, as LaTeX ($...$);
 *   - superscript and subscript formatting (x², H₂O typed with the font
 *     buttons), as LaTeX;
 *   - pictures, as image placeholders the page uploads (see IMAGE_URL_PREFIX);
 *   - tables: options laid out in a grid become option lines, a paper typed
 *     into a table becomes its questions, anything else becomes a table;
 *   - headings (Word's Heading and Title styles), as sections.
 * Equations made with the old MathType plug-in are pictures inside Word, so
 * they come across as pictures; a warning says so.
 */

import { unzipSync, strFromU8 } from "fflate";
import { DOMParser } from "@xmldom/xmldom";

/** Placeholder address for a picture until the page has uploaded it. */
export const IMAGE_URL_PREFIX = "docx-image:";

export interface DocxImage {
  /** The id used in the placeholder: ![](docx-image:<id>) */
  id: string;
  name: string;
  contentType: string;
  data: Uint8Array;
}

export interface DocxResult {
  text: string;
  images: DocxImage[];
  warnings: string[];
}

type El = Element;

const kids = (el: El | null | undefined): El[] =>
  el ? (Array.from(el.childNodes).filter((n) => n.nodeType === 1) as El[]) : [];
const child = (el: El | null | undefined, name: string): El | null =>
  kids(el).find((c) => c.nodeName === name) ?? null;
const val = (el: El | null | undefined, name: string, attr = "m:val"): string | null => {
  const c = child(el, name);
  return c ? c.getAttribute(attr) : null;
};

// ─────────────────────────────────────────────────────────────
// Office Math -> LaTeX
// ─────────────────────────────────────────────────────────────

const SYMBOLS: Record<string, string> = {
  "α": "\\alpha", "β": "\\beta", "γ": "\\gamma", "δ": "\\delta", "ε": "\\varepsilon", "ϵ": "\\epsilon",
  "ζ": "\\zeta", "η": "\\eta", "θ": "\\theta", "ϑ": "\\vartheta", "ι": "\\iota", "κ": "\\kappa",
  "λ": "\\lambda", "μ": "\\mu", "µ": "\\mu", "ν": "\\nu", "ξ": "\\xi", "π": "\\pi", "ρ": "\\rho",
  "σ": "\\sigma", "ς": "\\varsigma", "τ": "\\tau", "υ": "\\upsilon", "φ": "\\varphi", "ϕ": "\\phi",
  "χ": "\\chi", "ψ": "\\psi", "ω": "\\omega",
  "Γ": "\\Gamma", "Δ": "\\Delta", "∆": "\\Delta", "Θ": "\\Theta", "Λ": "\\Lambda", "Ξ": "\\Xi",
  "Π": "\\Pi", "Σ": "\\Sigma", "Φ": "\\Phi", "Ψ": "\\Psi", "Ω": "\\Omega", "\u2126": "\\Omega",
  "×": "\\times", "÷": "\\div", "±": "\\pm", "∓": "\\mp", "·": "\\cdot", "⋅": "\\cdot", "∙": "\\cdot",
  "≤": "\\le", "≥": "\\ge", "≠": "\\ne", "≈": "\\approx", "≅": "\\cong", "≡": "\\equiv", "∼": "\\sim",
  "∝": "\\propto", "∞": "\\infty", "→": "\\to", "←": "\\leftarrow", "↔": "\\leftrightarrow",
  "⇒": "\\Rightarrow", "⇐": "\\Leftarrow", "⇔": "\\Leftrightarrow", "⇌": "\\rightleftharpoons",
  "↑": "\\uparrow", "↓": "\\downarrow", "∈": "\\in", "∉": "\\notin", "∋": "\\ni", "⊂": "\\subset",
  "⊃": "\\supset", "⊆": "\\subseteq", "⊇": "\\supseteq", "∪": "\\cup", "∩": "\\cap", "∅": "\\emptyset",
  "∀": "\\forall", "∃": "\\exists", "¬": "\\neg", "∧": "\\wedge", "∨": "\\vee", "∂": "\\partial",
  "∇": "\\nabla", "°": "^{\\circ}", "′": "'", "″": "''", "…": "\\ldots", "⋯": "\\cdots", "⋮": "\\vdots",
  "−": "-", "–": "-", "ℏ": "\\hbar", "ℓ": "\\ell", "∠": "\\angle", "⊥": "\\perp", "∥": "\\parallel",
  "√": "\\surd", "∑": "\\sum", "∏": "\\prod", "∫": "\\int", "∬": "\\iint", "∭": "\\iiint", "∮": "\\oint",
  "⟨": "\\langle", "⟩": "\\rangle", "〈": "\\langle", "〉": "\\rangle", "⌊": "\\lfloor", "⌋": "\\rfloor",
  "⌈": "\\lceil", "⌉": "\\rceil", "ℝ": "\\mathbb{R}", "ℕ": "\\mathbb{N}", "ℤ": "\\mathbb{Z}",
  "ℚ": "\\mathbb{Q}", "ℂ": "\\mathbb{C}", "\u00a0": " ", "\u2009": "\\,", "\u200b": "",
};

/** Letters and symbols in maths, escaped for LaTeX. */
function mathText(text: string): string {
  let out = "";
  for (const ch of Array.from(text)) {
    if (SYMBOLS[ch] !== undefined) {
      const cmd = SYMBOLS[ch];
      out += /^\\[a-zA-Z]+$/.test(cmd) ? `${cmd} ` : cmd;
    } else if ("{}#%$&_".includes(ch)) {
      out += ch === "&" ? "&" : `\\${ch}`;
    } else if (ch === "\\") {
      out += "\\backslash ";
    } else if (ch === "^" || ch === "~") {
      out += `\\text{${ch}}`;
    } else {
      out += ch;
    }
  }
  return out;
}

const FUNCTIONS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "cosec", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
  "log", "ln", "lg", "exp", "lim", "max", "min", "sup", "inf", "det", "deg", "gcd", "arg", "dim", "ker",
]);

const ACCENTS: Record<string, string> = {
  "\u0302": "\\hat", "^": "\\hat", "\u0303": "\\tilde", "~": "\\tilde", "\u0307": "\\dot", "\u0308": "\\ddot",
  "\u20d7": "\\vec", "→": "\\vec", "\u0304": "\\bar", "¯": "\\bar", "\u0305": "\\overline",
  "\u0301": "\\acute", "\u0300": "\\grave", "\u030c": "\\check", "\u0306": "\\breve", "\u20d6": "\\overleftarrow",
};

const NARY: Record<string, string> = {
  "∑": "\\sum", "∏": "\\prod", "∐": "\\coprod", "∫": "\\int", "∬": "\\iint", "∭": "\\iiint",
  "∮": "\\oint", "⋃": "\\bigcup", "⋂": "\\bigcap", "⋁": "\\bigvee", "⋀": "\\bigwedge",
};

const DELIMS: Record<string, string> = {
  "(": "(", ")": ")", "[": "[", "]": "]", "{": "\\{", "}": "\\}", "|": "|", "‖": "\\|",
  "⟨": "\\langle", "⟩": "\\rangle", "〈": "\\langle", "〉": "\\rangle", "⌊": "\\lfloor", "⌋": "\\rfloor",
  "⌈": "\\lceil", "⌉": "\\rceil", "": ".",
};

const group = (s: string) => (s.length === 1 || /^\\[a-zA-Z]+\s?$/.test(s) ? s.trim() : `{${s}}`);

function omml(el: El): string {
  switch (el.nodeName) {
    case "m:r": {
      const t = kids(el).filter((c) => c.nodeName === "m:t").map((c) => c.textContent ?? "").join("");
      const normal = child(child(el, "m:rPr"), "m:nor") !== null;
      if (normal && /[a-zA-Z]{2,}/.test(t)) return `\\text{${t.replace(/[{}\\]/g, "")}}`;
      if (FUNCTIONS.has(t.trim())) return `\\${t.trim()} `;
      return mathText(t);
    }
    case "m:f": {
      const num = omml1(child(el, "m:num"));
      const den = omml1(child(el, "m:den"));
      const type = val(child(el, "m:fPr"), "m:type");
      if (type === "lin") return `${group(num)}/${group(den)}`;
      if (type === "noBar") return `\\genfrac{}{}{0pt}{}{${num}}{${den}}`;
      return `\\frac{${num}}{${den}}`;
    }
    case "m:sSup":
      return `${group(omml1(child(el, "m:e")))}^{${omml1(child(el, "m:sup"))}}`;
    case "m:sSub":
      return `${group(omml1(child(el, "m:e")))}_{${omml1(child(el, "m:sub"))}}`;
    case "m:sSubSup":
      return `${group(omml1(child(el, "m:e")))}_{${omml1(child(el, "m:sub"))}}^{${omml1(child(el, "m:sup"))}}`;
    case "m:sPre":
      return `{}_{${omml1(child(el, "m:sub"))}}^{${omml1(child(el, "m:sup"))}}${group(omml1(child(el, "m:e")))}`;
    case "m:rad": {
      const hidden = val(child(el, "m:radPr"), "m:degHide");
      const deg = omml1(child(el, "m:deg"));
      const e = omml1(child(el, "m:e"));
      return hidden === "1" || hidden === "on" || !deg ? `\\sqrt{${e}}` : `\\sqrt[${deg}]{${e}}`;
    }
    case "m:d": {
      const pr = child(el, "m:dPr");
      const beg = val(pr, "m:begChr") ?? "(";
      const end = val(pr, "m:endChr") ?? ")";
      const sep = val(pr, "m:sepChr") ?? "|";
      const parts = kids(el).filter((c) => c.nodeName === "m:e").map(omml1);
      const open = DELIMS[beg] ?? mathText(beg);
      const close = DELIMS[end] ?? mathText(end);
      return `\\left${open}${parts.join(` ${DELIMS[sep] ?? mathText(sep)} `)}\\right${close}`;
    }
    case "m:nary": {
      const pr = child(el, "m:naryPr");
      const chr = val(pr, "m:chr") ?? "∫";
      const op = NARY[chr] ?? mathText(chr);
      const sub = omml1(child(el, "m:sub"));
      const sup = omml1(child(el, "m:sup"));
      const limits = val(pr, "m:limLoc") === "undOvr" && !op.includes("int") ? "\\limits" : "";
      return `${op}${limits}${sub ? `_{${sub}}` : ""}${sup ? `^{${sup}}` : ""} ${omml1(child(el, "m:e"))}`;
    }
    case "m:func": {
      const name = omml1(child(el, "m:fName")).trim();
      return `${name} ${group(omml1(child(el, "m:e")))}`;
    }
    case "m:limLow": {
      const base = omml1(child(el, "m:e")).trim();
      const lim = omml1(child(el, "m:lim"));
      return /^\\(lim|max|min|sup|inf)\s?$/.test(base) || base === "lim"
        ? `\\${base.replace(/^\\/, "").trim()}_{${lim}}`
        : `\\underset{${lim}}{${base}}`;
    }
    case "m:limUpp":
      return `\\overset{${omml1(child(el, "m:lim"))}}{${omml1(child(el, "m:e"))}}`;
    case "m:acc": {
      const chr = val(child(el, "m:accPr"), "m:chr") ?? "\u0302";
      return `${ACCENTS[chr] ?? "\\hat"}{${omml1(child(el, "m:e"))}}`;
    }
    case "m:bar": {
      const pos = val(child(el, "m:barPr"), "m:pos");
      return `${pos === "bot" ? "\\underline" : "\\overline"}{${omml1(child(el, "m:e"))}}`;
    }
    case "m:groupChr": {
      const pr = child(el, "m:groupChrPr");
      const chr = val(pr, "m:chr") ?? "⏟";
      const e = omml1(child(el, "m:e"));
      if (chr === "⏞") return `\\overbrace{${e}}`;
      if (chr === "→" || chr === "⟶") return `\\xrightarrow{${e}}`;
      if (chr === "←") return `\\xleftarrow{${e}}`;
      return `\\underbrace{${e}}`;
    }
    case "m:borderBox":
      return `\\boxed{${omml1(child(el, "m:e"))}}`;
    case "m:eqArr":
      return `\\begin{aligned}${kids(el)
        .filter((c) => c.nodeName === "m:e")
        .map((e) => omml1(e))
        .join(" \\\\ ")}\\end{aligned}`;
    case "m:m": {
      const rows = kids(el)
        .filter((c) => c.nodeName === "m:mr")
        .map((row) => kids(row).filter((c) => c.nodeName === "m:e").map(omml1).join(" & "));
      return `\\begin{matrix}${rows.join(" \\\\ ")}\\end{matrix}`;
    }
    case "m:phant":
      return "";
    // Property blocks carry no content.
    case "m:rPr":
    case "m:ctrlPr":
    case "m:fPr":
    case "m:dPr":
    case "m:naryPr":
    case "m:radPr":
    case "m:accPr":
    case "m:barPr":
    case "m:funcPr":
    case "m:limLowPr":
    case "m:limUppPr":
    case "m:mPr":
    case "m:eqArrPr":
    case "m:groupChrPr":
    case "m:sSupPr":
    case "m:sSubPr":
    case "m:sSubSupPr":
    case "m:sPrePr":
    case "m:oMathParaPr":
    case "w:rPr":
      return "";
    default:
      // Containers (m:e, m:num, m:sub, m:oMath, m:box ...) and anything
      // unknown: their content, in order.
      return kids(el).map(omml).join("");
  }
}

/** The content of one container element, or "" when it is missing. */
function omml1(el: El | null): string {
  return el ? kids(el).map(omml).join("").replace(/\s+/g, " ").trim() : "";
}

/** One equation (m:oMath) as LaTeX. Exported for tests. */
export function ommlToLatex(el: El): string {
  return omml1(el).replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────
// Numbering
// ─────────────────────────────────────────────────────────────

interface Level {
  fmt: string;
  text: string;
  start: number;
}

function roman(n: number): string {
  const table: [number, string][] = [
    [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
    [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
  ];
  let out = "";
  for (const [v, s] of table) while (n >= v) (out += s), (n -= v);
  return out;
}

function letters(n: number): string {
  let out = "";
  while (n > 0) {
    n--;
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}

function formatCounter(n: number, fmt: string): string {
  switch (fmt) {
    case "lowerLetter":
      return letters(n);
    case "upperLetter":
      return letters(n).toUpperCase();
    case "lowerRoman":
      return roman(n);
    case "upperRoman":
      return roman(n).toUpperCase();
    default:
      return String(n);
  }
}

class Numbering {
  private abstracts = new Map<string, Map<number, Level>>();
  private nums = new Map<string, { abstractId: string; starts: Map<number, number> }>();
  private counters = new Map<string, number[]>();
  styleNumbering = new Map<string, { numId: string; ilvl: number }>();

  constructor(numberingXml: Document | null, stylesXml: Document | null) {
    const root = numberingXml?.documentElement;
    for (const abs of kids(root).filter((c) => c.nodeName === "w:abstractNum")) {
      const levels = new Map<number, Level>();
      for (const lvl of kids(abs).filter((c) => c.nodeName === "w:lvl")) {
        levels.set(Number(lvl.getAttribute("w:ilvl") ?? 0), {
          fmt: val(lvl, "w:numFmt", "w:val") ?? "decimal",
          text: val(lvl, "w:lvlText", "w:val") ?? "",
          start: Number(val(lvl, "w:start", "w:val") ?? 1),
        });
      }
      this.abstracts.set(abs.getAttribute("w:abstractNumId") ?? "", levels);
    }
    for (const num of kids(root).filter((c) => c.nodeName === "w:num")) {
      const starts = new Map<number, number>();
      for (const o of kids(num).filter((c) => c.nodeName === "w:lvlOverride")) {
        const start = val(o, "w:startOverride", "w:val");
        if (start !== null) starts.set(Number(o.getAttribute("w:ilvl") ?? 0), Number(start));
      }
      this.nums.set(num.getAttribute("w:numId") ?? "", {
        abstractId: val(num, "w:abstractNumId", "w:val") ?? "",
        starts,
      });
    }
    for (const style of kids(stylesXml?.documentElement).filter((c) => c.nodeName === "w:style")) {
      const numPr = child(child(style, "w:pPr"), "w:numPr");
      const numId = val(numPr, "w:numId", "w:val");
      if (numId) {
        this.styleNumbering.set(style.getAttribute("w:styleId") ?? "", {
          numId,
          ilvl: Number(val(numPr, "w:ilvl", "w:val") ?? 0),
        });
      }
    }
  }

  /** The label Word would print for the next paragraph in this list. */
  next(numId: string, ilvl: number): string {
    const num = this.nums.get(numId);
    const levels = num ? this.abstracts.get(num.abstractId) : undefined;
    if (!num || !levels || numId === "0") return "";
    const counters = this.counters.get(numId) ?? [];
    const levelStart = (l: number) => num.starts.get(l) ?? levels.get(l)?.start ?? 1;
    counters[ilvl] = counters[ilvl] === undefined ? levelStart(ilvl) : counters[ilvl] + 1;
    counters.length = ilvl + 1; // deeper levels restart
    this.counters.set(numId, counters);

    const level = levels.get(ilvl);
    if (!level || level.fmt === "bullet" || level.fmt === "none") return "";
    return level.text.replace(/%(\d)/g, (_, d: string) => {
      const l = Number(d) - 1;
      const n = counters[l] ?? levelStart(l);
      return formatCounter(n, levels.get(l)?.fmt ?? "decimal");
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Document body
// ─────────────────────────────────────────────────────────────

/** Symbol-font characters Word stores by code point (w:sym). */
const SYMBOL_FONT: Record<string, string> = {
  F061: "α", F062: "β", F063: "χ", F064: "δ", F065: "ε", F066: "φ", F067: "γ", F068: "η", F069: "ι",
  F06B: "κ", F06C: "λ", F06D: "μ", F06E: "ν", F070: "π", F071: "θ", F072: "ρ", F073: "σ", F074: "τ",
  F075: "υ", F077: "ω", F078: "ξ", F079: "ψ", F07A: "ζ", F044: "Δ", F057: "Ω", F046: "Φ", F053: "Σ",
  F0B4: "×", F0B8: "÷", F0B1: "±", F0A3: "≤", F0B3: "≥", F0B9: "≠", F0BB: "≈", F0AE: "→", F0DE: "⇒",
  F0A5: "∞", F0B0: "°", F0B6: "∂", F0D6: "√", F0E5: "∑", F0F2: "∫", F0CE: "∈", F0C7: "∩", F0C8: "∪",
};

const TEXT_ESCAPE = (t: string) => t.replace(/\$/g, "\\$").replace(/\u00a0/g, " ");

interface Ctx {
  rels: Map<string, string>;
  files: Record<string, Uint8Array>;
  images: DocxImage[];
  imageIds: Map<string, string>;
  numbering: Numbering;
  warnings: Set<string>;
}

function imageFor(rId: string | null, ctx: Ctx): string {
  if (!rId) return "";
  const target = ctx.rels.get(rId);
  if (!target) return "";
  const path = target.startsWith("/") ? target.slice(1) : `word/${target.replace(/^\.\//, "")}`;
  const data = ctx.files[path];
  if (!data) return "";
  let id = ctx.imageIds.get(path);
  if (!id) {
    id = `img${ctx.images.length + 1}`;
    ctx.imageIds.set(path, id);
    const ext = path.split(".").pop()?.toLowerCase() ?? "png";
    const contentType =
      ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : ext === "png" ? "image/png" : `image/${ext}`;
    if (ext === "emf" || ext === "wmf") {
      ctx.warnings.add(
        "Some pictures are in Word's own EMF/WMF format (often MathType equations), which browsers cannot show. Replace them with the equation typed in $...$, or a PNG."
      );
    }
    ctx.images.push({ id, name: path.split("/").pop() ?? id, contentType, data });
  }
  return `![](${IMAGE_URL_PREFIX}${id})`;
}

function findAll(el: El, name: string, out: El[] = []): El[] {
  for (const c of kids(el)) {
    if (c.nodeName === name) out.push(c);
    findAll(c, name, out);
  }
  return out;
}

function runText(run: El, ctx: Ctx): string {
  const rPr = child(run, "w:rPr");
  const vert = val(rPr, "w:vertAlign", "w:val");
  let text = "";
  for (const c of kids(run)) {
    switch (c.nodeName) {
      case "w:t":
        text += c.textContent ?? "";
        break;
      case "w:tab":
        text += " ";
        break;
      case "w:br":
      case "w:cr":
        text += "\n";
        break;
      case "w:noBreakHyphen":
        text += "-";
        break;
      case "w:sym": {
        const code = (c.getAttribute("w:char") ?? "").toUpperCase();
        const mapped = SYMBOL_FONT[code] ?? SYMBOL_FONT[`F0${code.slice(-2)}`];
        if (mapped) text += mapped;
        else ctx.warnings.add("Some symbols typed with Word's Symbol font could not be read. Check the preview for gaps.");
        break;
      }
      case "w:drawing":
        for (const blip of findAll(c, "a:blip")) text += imageFor(blip.getAttribute("r:embed"), ctx);
        break;
      case "w:pict":
      case "w:object": {
        const images = findAll(c, "v:imagedata");
        if (c.nodeName === "w:object") {
          ctx.warnings.add(
            "The file has equations made with MathType or the old equation editor. They come across as pictures; for sharper, searchable maths, retype them in $...$."
          );
        }
        for (const img of images) text += imageFor(img.getAttribute("r:id"), ctx);
        break;
      }
    }
  }
  if (!text) return "";
  if ((vert === "superscript" || vert === "subscript") && text.trim() && !text.includes("![")) {
    const t = mathText(text.trim());
    return vert === "superscript" ? `\${}^{${t}}$` : `\${}_{${t}}$`;
  }
  return TEXT_ESCAPE(text);
}

function inlineText(el: El, ctx: Ctx): string {
  let out = "";
  for (const c of kids(el)) {
    switch (c.nodeName) {
      case "w:r":
        out += runText(c, ctx);
        break;
      case "m:oMath":
        out += `$${ommlToLatex(c)}$`;
        break;
      case "m:oMathPara":
        for (const m of kids(c).filter((k) => k.nodeName === "m:oMath")) out += `$$${ommlToLatex(m)}$$`;
        break;
      case "w:del":
      case "w:pPr":
      case "w:rPr":
        break;
      default:
        // Hyperlinks, tracked insertions, content controls, fields...
        out += inlineText(c, ctx);
    }
  }
  return out;
}

function paragraphText(p: El, ctx: Ctx): string {
  const pPr = child(p, "w:pPr");
  const numPr = child(pPr, "w:numPr");
  let numId = val(numPr, "w:numId", "w:val");
  let ilvl = Number(val(numPr, "w:ilvl", "w:val") ?? 0);
  if (!numId) {
    const style = ctx.numbering.styleNumbering.get(val(pPr, "w:pStyle", "w:val") ?? "");
    if (style) ({ numId, ilvl } = style);
  }
  const label = numId ? ctx.numbering.next(numId, ilvl) : "";
  const body = inlineText(p, ctx).replace(/[ \t]+/g, " ").trim();
  // Word's Heading and Title styles mark sections ("Physics", "Section B").
  const style = val(pPr, "w:pStyle", "w:val") ?? "";
  if (body && /^(heading\s?\d|title|subtitle)$/i.test(style)) return `# ${body}`;
  return label && body ? `${label} ${body}` : body;
}

const OPTION_CELL_RE = /^\(?[A-Da-d][.)]\s/;

function tableLines(tbl: El, ctx: Ctx): string[] {
  const rows = kids(tbl)
    .filter((c) => c.nodeName === "w:tr")
    .map((tr) =>
      kids(tr)
        .filter((c) => c.nodeName === "w:tc")
        .map((tc) =>
          blockLines(tc, ctx)
            .filter(Boolean)
            .join(" ")
            .trim()
        )
    );
  const cells = rows.flat().filter(Boolean);
  if (cells.length === 0) return [];

  // Options set out in a grid: one option per line.
  if (cells.every((c) => OPTION_CELL_RE.test(c))) return cells;

  // A whole paper typed into a table, number in the first column: its rows
  // are questions and options.
  const numbered = rows.filter((r) => /^(Q\.?\s*)?\d{1,3}[.)]?$/i.test(r[0] ?? ""));
  if (rows.length >= 3 && numbered.length >= rows.length / 2) {
    return rows.flatMap((r) => {
      const [first, ...rest] = r;
      const n = first.match(/\d+/)?.[0];
      return n && /^(Q\.?\s*)?\d{1,3}[.)]?$/i.test(first)
        ? [`${n}. ${rest.filter(Boolean).join(" ")}`]
        : r.filter(Boolean);
    });
  }

  // Anything else is a real table, such as the two lists of a match question.
  return rows.map((r) => `| ${r.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`);
}

function blockLines(el: El, ctx: Ctx): string[] {
  const lines: string[] = [];
  for (const c of kids(el)) {
    if (c.nodeName === "w:p") lines.push(...paragraphText(c, ctx).split("\n"));
    else if (c.nodeName === "w:tbl") lines.push(...tableLines(c, ctx));
    else if (c.nodeName === "w:sdt") lines.push(...blockLines(child(c, "w:sdtContent") ?? c, ctx));
    else if (c.nodeName === "w:customXml") lines.push(...blockLines(c, ctx));
  }
  return lines;
}

function parseXml(files: Record<string, Uint8Array>, path: string): Document | null {
  const data = files[path];
  if (!data) return null;
  return new DOMParser().parseFromString(strFromU8(data), "text/xml") as unknown as Document;
}

/** Reads a .docx file's bytes. Throws with a plain message when it is not one. */
export function readDocx(bytes: Uint8Array): DocxResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("This is not a Word file (.docx). If it is an old .doc file, open it in Word and save it as .docx.");
  }
  const doc = parseXml(files, "word/document.xml");
  const body = doc ? child(doc.documentElement as El, "w:body") : null;
  if (!body) throw new Error("This file has no document in it. Is it a Word (.docx) file?");

  const rels = new Map<string, string>();
  const relsXml = parseXml(files, "word/_rels/document.xml.rels");
  for (const rel of kids(relsXml?.documentElement as El | undefined)) {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (id && target) rels.set(id, target);
  }

  const ctx: Ctx = {
    rels,
    files,
    images: [],
    imageIds: new Map(),
    numbering: new Numbering(parseXml(files, "word/numbering.xml"), parseXml(files, "word/styles.xml")),
    warnings: new Set(),
  };

  const text = blockLines(body as El, ctx)
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, images: ctx.images, warnings: Array.from(ctx.warnings) };
}
