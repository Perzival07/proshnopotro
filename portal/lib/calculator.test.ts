import { describe, it, expect } from "vitest";
import { evaluate, formatResult } from "./calculator";

const value = (input: string, mode: "deg" | "rad" = "deg", ans = 0) => {
  const r = evaluate(input, mode, ans);
  if ("error" in r) throw new Error(r.error);
  return r.value;
};
const error = (input: string) => {
  const r = evaluate(input);
  return "error" in r ? r.error : null;
};

describe("evaluate", () => {
  it("follows the order of operations", () => {
    expect(value("2+3*4")).toBe(14);
    expect(value("(2+3)*4")).toBe(20);
    expect(value("2^3^2")).toBe(512);
    expect(value("-2^2")).toBe(-4);
    expect(value("10/4-1")).toBe(1.5);
  });

  it("reads the keypad's symbols", () => {
    expect(value("6×7")).toBe(42);
    expect(value("9÷3")).toBe(3);
    expect(value("5−8")).toBe(-3);
    expect(value("√16")).toBe(4);
  });

  it("multiplies implicitly", () => {
    expect(value("2π")).toBeCloseTo(2 * Math.PI);
    expect(value("3(4+1)")).toBe(15);
    expect(value("2sin(30)")).toBeCloseTo(1);
  });

  it("works in degrees and radians", () => {
    expect(value("sin(30)")).toBeCloseTo(0.5);
    expect(value("sin(180)")).toBe(0);
    expect(value("cos(pi)", "rad")).toBeCloseTo(-1);
    expect(value("asin(1)")).toBeCloseTo(90);
    expect(value("atan(1)", "rad")).toBeCloseTo(Math.PI / 4);
  });

  it("has logs, roots, powers, factorial and percent", () => {
    expect(value("log(1000)")).toBeCloseTo(3);
    expect(value("ln(e)")).toBeCloseTo(1);
    expect(value("cbrt(27)")).toBeCloseTo(3);
    expect(value("5!")).toBe(120);
    expect(value("50%")).toBe(0.5);
    expect(value("exp(0)")).toBe(1);
  });

  it("uses the previous answer", () => expect(value("Ans*2", "deg", 21)).toBe(42));

  it("explains mistakes instead of guessing", () => {
    expect(error("1/0")).toMatch(/divide by zero/);
    expect(error("(2+3")).toMatch(/not closed/);
    expect(error("2+3)")).toMatch(/too many/);
    expect(error("sqrt(-4)")).toMatch(/0 or more/);
    expect(error("tan(90)")).toMatch(/undefined/);
    expect(error("2.5!")).toMatch(/whole number/);
    expect(error("2 $ 3")).toMatch(/understands/);
    expect(error("")).toMatch(/Type/);
    expect(error("5*")).toMatch(/not finished/);
  });
});

describe("formatResult", () => {
  it("rounds away floating-point noise", () => expect(formatResult(0.1 + 0.2)).toBe("0.3"));
  it("uses exponents for very large and small numbers", () => {
    expect(formatResult(6.02214076e23)).toBe("6.02214076e+23");
    expect(formatResult(1.6e-19)).toBe("1.6e-19");
  });
});

describe("functions without brackets", () => {
  it("apply to the number straight after", () => {
    expect(value("√16+1")).toBe(5);
    expect(value("sin30")).toBeCloseTo(0.5);
  });
  it("explain a function with nothing after it", () => expect(error("√")).toMatch(/Put a number/));
});
