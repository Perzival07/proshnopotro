import { describe, it, expect, vi } from "vitest";
import {
  supportsNativeFullscreen, enterFullscreen, exitFullscreen, isNativeFullscreen,
} from "./fullscreen";

const el = (o: Record<string, unknown>) => o as never;
const doc = (o: Record<string, unknown>) => o as never;

describe("supportsNativeFullscreen", () => {
  it("detects the standard API", () =>
    expect(supportsNativeFullscreen(el({ requestFullscreen: () => {} }))).toBe(true));
  it("detects the webkit-prefixed API", () =>
    expect(supportsNativeFullscreen(el({ webkitRequestFullscreen: () => {} }))).toBe(true));
  it("is false where neither exists (iOS Safari on an element)", () =>
    expect(supportsNativeFullscreen(el({}))).toBe(false));
  it("is false for null", () => expect(supportsNativeFullscreen(null)).toBe(false));
});

describe("enterFullscreen", () => {
  it("uses the standard API and reports success", async () => {
    const req = vi.fn().mockResolvedValue(undefined);
    expect(await enterFullscreen(el({ requestFullscreen: req }))).toBe(true);
    expect(req).toHaveBeenCalled();
  });
  it("falls back to the webkit API", async () => {
    const req = vi.fn().mockResolvedValue(undefined);
    expect(await enterFullscreen(el({ webkitRequestFullscreen: req }))).toBe(true);
  });
  it("returns false instead of throwing when the request is rejected", async () => {
    // Browsers reject this outside a user gesture; the overlay must still work.
    const req = vi.fn().mockRejectedValue(new Error("not allowed"));
    expect(await enterFullscreen(el({ requestFullscreen: req }))).toBe(false);
  });
  it("returns false when unsupported", async () =>
    expect(await enterFullscreen(el({}))).toBe(false));
  it("returns false for null", async () =>
    expect(await enterFullscreen(null)).toBe(false));
});

describe("isNativeFullscreen", () => {
  it("reads either vendor property", () => {
    expect(isNativeFullscreen(doc({ fullscreenElement: {} }))).toBe(true);
    expect(isNativeFullscreen(doc({ webkitFullscreenElement: {} }))).toBe(true);
    expect(isNativeFullscreen(doc({ fullscreenElement: null }))).toBe(false);
  });
});

describe("exitFullscreen", () => {
  it("does nothing when not in native fullscreen", async () => {
    const exit = vi.fn();
    await exitFullscreen(doc({ fullscreenElement: null, exitFullscreen: exit }));
    expect(exit).not.toHaveBeenCalled();
  });
  it("calls the standard exit when in fullscreen", async () => {
    const exit = vi.fn().mockResolvedValue(undefined);
    await exitFullscreen(doc({ fullscreenElement: {}, exitFullscreen: exit }));
    expect(exit).toHaveBeenCalled();
  });
  it("swallows a rejected exit", async () => {
    const exit = vi.fn().mockRejectedValue(new Error("nope"));
    await expect(
      exitFullscreen(doc({ fullscreenElement: {}, exitFullscreen: exit }))
    ).resolves.toBeUndefined();
  });
});
