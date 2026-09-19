/**
 * The on-screen calculator's arithmetic, for papers that allow one (GATE and
 * similar; JEE Main and NEET do not).
 *
 * A small recursive-descent parser rather than eval: nothing a student types
 * can run as code, and the grammar is exactly what the keypad offers.
 *
 *   expression := term (("+" | "-") term)*
 *   term       := signed (("*" | "/") signed | signed)*   <- the bare form is 2π, 3(4)
 *   signed     := ("-" | "+") signed | power
 *   power      := postfix ("^" signed)?                     <- right-associative; -2^2 = -4
 *   postfix    := primary ("!" | "%")*
 *   primary    := number | constant | function ("(" expression ")" | postfix) | "(" expression ")"
 */

export type AngleMode = "deg" | "rad";

const FUNCTIONS = [
  "asin", "acos", "atan", "sinh", "cosh", "tanh", "sin", "cos", "tan",
  "log", "ln", "sqrt", "cbrt", "exp", "abs",
] as const;
type Fn = (typeof FUNCTIONS)[number];

type Token =
  | { t: "num"; v: number }
  | { t: "op"; v: string }
  | { t: "fn"; v: Fn }
  | { t: "const"; v: number }
  | { t: "(" }
  | { t: ")" };

class CalcError extends Error {}

function tokenize(input: string, ans: number): Token[] {
  const s = input
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/√/g, "sqrt")
    .replace(/∛/g, "cbrt");
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    const num = rest.match(/^(\d+\.?\d*|\.\d+)/);
    if (num) {
      tokens.push({ t: "num", v: Number(num[1]) });
      i += num[1].length;
      continue;
    }
    if (/^(pi|π)/i.test(rest)) {
      tokens.push({ t: "const", v: Math.PI });
      i += rest[0] === "π" ? 1 : 2;
      continue;
    }
    if (/^ans/i.test(rest)) {
      tokens.push({ t: "const", v: ans });
      i += 3;
      continue;
    }
    const fn = FUNCTIONS.find((f) => rest.toLowerCase().startsWith(f));
    if (fn) {
      tokens.push({ t: "fn", v: fn });
      i += fn.length;
      continue;
    }
    if (rest[0] === "e") {
      tokens.push({ t: "const", v: Math.E });
      i += 1;
      continue;
    }
    if ("+-*/^!%".includes(rest[0])) {
      tokens.push({ t: "op", v: rest[0] });
      i += 1;
      continue;
    }
    if (rest[0] === "(" || rest[0] === ")") {
      tokens.push({ t: rest[0] } as Token);
      i += 1;
      continue;
    }
    throw new CalcError(`"${rest[0]}" is not something the calculator understands.`);
  }
  return tokens;
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new CalcError("Factorial needs a whole number, 0 or more.");
  if (n > 170) throw new CalcError("That factorial is too large.");
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}

function applyFn(fn: Fn, x: number, mode: AngleMode): number {
  const toRad = (v: number) => (mode === "deg" ? (v * Math.PI) / 180 : v);
  const fromRad = (v: number) => (mode === "deg" ? (v * 180) / Math.PI : v);
  // Exact values at the angles students use most, where floating point would
  // otherwise show sin 180 as 1.2e-16 and tan 90 as a huge number.
  const exact = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
  switch (fn) {
    case "sin":
      return exact(Math.sin(toRad(x)));
    case "cos":
      return exact(Math.cos(toRad(x)));
    case "tan": {
      if (mode === "deg" && Math.abs(x % 180) === 90) throw new CalcError("tan is undefined there.");
      return exact(Math.tan(toRad(x)));
    }
    case "asin":
      if (x < -1 || x > 1) throw new CalcError("sin⁻¹ needs a value from −1 to 1.");
      return fromRad(Math.asin(x));
    case "acos":
      if (x < -1 || x > 1) throw new CalcError("cos⁻¹ needs a value from −1 to 1.");
      return fromRad(Math.acos(x));
    case "atan":
      return fromRad(Math.atan(x));
    case "sinh":
      return Math.sinh(x);
    case "cosh":
      return Math.cosh(x);
    case "tanh":
      return Math.tanh(x);
    case "log":
      if (x <= 0) throw new CalcError("log needs a number above 0.");
      return Math.log10(x);
    case "ln":
      if (x <= 0) throw new CalcError("ln needs a number above 0.");
      return Math.log(x);
    case "sqrt":
      if (x < 0) throw new CalcError("√ needs a number, 0 or more.");
      return Math.sqrt(x);
    case "cbrt":
      return Math.cbrt(x);
    case "exp":
      return Math.exp(x);
    case "abs":
      return Math.abs(x);
  }
}

function parse(tokens: Token[], mode: AngleMode): number {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === "op" && (peek() as { v: string }).v === v;

  const expression = (): number => {
    let v = term();
    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos++] as { v: string }).v;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };

  // Something that can follow directly with an implied "×": 2π, 3(4), 2sin(30).
  const startsFactor = () => {
    const t = peek();
    return !!t && (t.t === "num" || t.t === "const" || t.t === "fn" || t.t === "(");
  };

  const term = (): number => {
    let v = signed();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = (tokens[pos++] as { v: string }).v;
        const r = signed();
        if (op === "/" && r === 0) throw new CalcError("Cannot divide by zero.");
        v = op === "*" ? v * r : v / r;
      } else if (startsFactor()) {
        v *= signed();
      } else {
        return v;
      }
    }
  };

  const signed = (): number => {
    if (isOp("-")) {
      pos++;
      return -signed();
    }
    if (isOp("+")) {
      pos++;
      return signed();
    }
    return power();
  };

  const power = (): number => {
    const base = postfix();
    if (isOp("^")) {
      pos++;
      return Math.pow(base, signed());
    }
    return base;
  };

  const postfix = (): number => {
    let v = primary();
    while (isOp("!") || isOp("%")) {
      const op = (tokens[pos++] as { v: string }).v;
      v = op === "!" ? factorial(v) : v / 100;
    }
    return v;
  };

  const primary = (): number => {
    const t = tokens[pos++];
    if (!t) throw new CalcError("The expression is not finished.");
    if (t.t === "num" || t.t === "const") return t.v;
    if (t.t === "fn") {
      // Without brackets a function takes what comes straight after it, as on
      // a hand calculator: √16, sin30.
      if (peek()?.t !== "(") {
        if (!peek()) throw new CalcError(`Put a number after ${t.v}.`);
        return applyFn(t.v, postfix(), mode);
      }
      pos++;
      const inner = expression();
      if (peek()?.t !== ")") throw new CalcError("A bracket is not closed.");
      pos++;
      return applyFn(t.v, inner, mode);
    }
    if (t.t === "(") {
      const inner = expression();
      if (peek()?.t !== ")") throw new CalcError("A bracket is not closed.");
      pos++;
      return inner;
    }
    throw new CalcError("Something is missing before this.");
  };

  const value = expression();
  if (pos < tokens.length) {
    throw new CalcError(tokens[pos].t === ")" ? "There is a closing bracket too many." : "Something is missing here.");
  }
  return value;
}

export type CalcResult = { value: number; display: string } | { error: string };

/** A number as a calculator shows it: up to 10 significant figures. */
export function formatResult(n: number): string {
  if (Object.is(n, -0)) return "0";
  if (Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-9 && n !== 0)) {
    return n.toExponential(8).replace(/\.?0+e/, "e");
  }
  return String(Number(n.toPrecision(10)));
}

export function evaluate(input: string, mode: AngleMode = "deg", ans = 0): CalcResult {
  if (!input.trim()) return { error: "Type a calculation." };
  try {
    const value = parse(tokenize(input, ans), mode);
    if (!Number.isFinite(value)) return { error: "The answer is too large to show." };
    return { value, display: formatResult(value) };
  } catch (err) {
    return { error: err instanceof CalcError ? err.message : "That calculation could not be worked out." };
  }
}
