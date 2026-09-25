import { describe, expect, it, vi } from "vitest";
import { isMediapipeInfo, silenceMediapipeInfo } from "./mediapipe-log";

describe("silenceMediapipeInfo", () => {
  it("drops the runtime's INFO lines but passes real errors through", () => {
    const seen: unknown[][] = [];
    const fake = { error: (...args: unknown[]) => void seen.push(args) };
    silenceMediapipeInfo(fake);

    fake.error("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.");
    fake.error("Something actually broke", 42);
    fake.error(new Error("boom"));

    expect(seen).toHaveLength(2);
    expect(seen[0]).toEqual(["Something actually broke", 42]);
  });

  it("installs only once", () => {
    const spy = vi.fn();
    const fake = { error: spy };
    silenceMediapipeInfo(fake);
    const first = fake.error;
    silenceMediapipeInfo(fake);
    expect(fake.error).toBe(first);

    fake.error("real");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("isMediapipeInfo", () => {
  it("matches only strings that start with INFO:", () => {
    expect(isMediapipeInfo(["INFO: hello"])).toBe(true);
    expect(isMediapipeInfo(["ERROR: INFO: hello"])).toBe(false);
    expect(isMediapipeInfo([{ message: "INFO:" }])).toBe(false);
    expect(isMediapipeInfo([])).toBe(false);
  });
});
