import { describe, expect, it } from "vitest";
import { createScanGate, DEFAULT_SCAN_CONFIG, scanMessage } from "./proctor-scan";

const ONE = { faceWidths: [0.3] };
const NONE = { faceWidths: [] };
const TWO = { faceWidths: [0.3, 0.25] };

describe("createScanGate", () => {
  it("passes only after one clear face has held for the full time", () => {
    const gate = createScanGate();
    expect(gate.observe(ONE, 0).state).toBe("holding");
    expect(gate.observe(ONE, 1000).state).toBe("holding");
    expect(gate.observe(ONE, 1999).state).toBe("holding");
    expect(gate.observe(ONE, 2000)).toEqual({ state: "passed", progress: 1 });
  });

  it("reports progress through the hold", () => {
    const gate = createScanGate();
    gate.observe(ONE, 0);
    expect(gate.observe(ONE, 1000).progress).toBeCloseTo(0.5);
  });

  it("does not pass on a single frame", () => {
    const gate = createScanGate();
    expect(gate.observe(ONE, 0).state).not.toBe("passed");
  });

  it("restarts the hold when the face leaves", () => {
    const gate = createScanGate();
    gate.observe(ONE, 0);
    gate.observe(ONE, 1000);
    expect(gate.observe(NONE, 1500)).toEqual({ state: "no-face", progress: 0 });
    gate.observe(ONE, 2000);
    expect(gate.observe(ONE, 3500).state).toBe("holding");
    expect(gate.observe(ONE, 4000).state).toBe("passed");
  });

  it("refuses while a second face is in view", () => {
    const gate = createScanGate();
    gate.observe(ONE, 0);
    expect(gate.observe(TWO, 500).state).toBe("multiple");
    gate.observe(TWO, 1000);
    expect(gate.observe(TWO, 5000).state).toBe("multiple");
  });

  it("refuses a face too small in the frame", () => {
    const gate = createScanGate();
    const far = { faceWidths: [DEFAULT_SCAN_CONFIG.minFaceWidth - 0.01] };
    expect(gate.observe(far, 0).state).toBe("too-far");
    expect(gate.observe(far, 5000).state).toBe("too-far");
  });

  it("accepts a face exactly at the minimum width", () => {
    const gate = createScanGate();
    const edge = { faceWidths: [DEFAULT_SCAN_CONFIG.minFaceWidth] };
    expect(gate.observe(edge, 0).state).toBe("holding");
  });

  it("drops the hold across a long gap between frames", () => {
    const gate = createScanGate();
    gate.observe(ONE, 0);
    gate.observe(ONE, 1000);
    // The page was throttled: 3s with no frames must not count as watched time.
    expect(gate.observe(ONE, 4000).state).toBe("holding");
    expect(gate.observe(ONE, 5000).progress).toBeCloseTo(0.5);
  });

  it("stays passed once passed", () => {
    const gate = createScanGate();
    gate.observe(ONE, 0);
    gate.observe(ONE, 1000);
    gate.observe(ONE, 2000);
    expect(gate.observe(NONE, 2500).state).toBe("passed");
  });

  it("starts over after a reset", () => {
    const gate = createScanGate();
    gate.observe(ONE, 0);
    gate.observe(ONE, 1000);
    gate.observe(ONE, 2000);
    gate.reset();
    expect(gate.observe(ONE, 3000).state).toBe("holding");
  });
});

describe("scanMessage", () => {
  it("has a message for every state", () => {
    for (const state of ["starting", "no-face", "multiple", "too-far", "holding", "passed"] as const) {
      expect(scanMessage(state).length).toBeGreaterThan(0);
    }
  });
});
