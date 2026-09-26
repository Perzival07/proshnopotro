import { describe, it, expect } from "vitest";
import {
  isCaptureKey,
  isPrintOrSaveShortcut,
  isScreenshotShortcut,
  isTextEntry,
  registerCapture,
  type KeyLike,
} from "./content-guard";

const key = (over: Partial<KeyLike>): KeyLike => ({
  key: "",
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...over,
});

describe("isCaptureKey", () => {
  it("catches PrintScreen by key or by code", () => {
    expect(isCaptureKey(key({ key: "PrintScreen" }))).toBe(true);
    expect(isCaptureKey(key({ key: "Unidentified", code: "PrintScreen" }))).toBe(true);
  });

  it("catches the macOS and Windows screenshot chords", () => {
    expect(isCaptureKey(key({ key: "4", metaKey: true, shiftKey: true }))).toBe(true); // Cmd+Shift+4
    expect(isCaptureKey(key({ key: "s", metaKey: true, shiftKey: true }))).toBe(true); // Win+Shift+S
    expect(isCaptureKey(key({ key: "Shift", metaKey: true, shiftKey: true }))).toBe(true);
  });

  it("leaves ordinary typing alone", () => {
    expect(isCaptureKey(key({ key: "a" }))).toBe(false);
    expect(isCaptureKey(key({ key: "A", shiftKey: true }))).toBe(false);
    expect(isCaptureKey(key({ key: "c", metaKey: true }))).toBe(false);
  });
});

describe("isPrintOrSaveShortcut", () => {
  it("matches Ctrl/Cmd+P and Ctrl/Cmd+S in either case", () => {
    expect(isPrintOrSaveShortcut(key({ key: "p", ctrlKey: true }))).toBe(true);
    expect(isPrintOrSaveShortcut(key({ key: "S", metaKey: true }))).toBe(true);
  });

  it("does not match the letter alone or other chords", () => {
    expect(isPrintOrSaveShortcut(key({ key: "p" }))).toBe(false);
    expect(isPrintOrSaveShortcut(key({ key: "a", ctrlKey: true }))).toBe(false);
  });
});

describe("isTextEntry", () => {
  it("is true for inputs and textareas, false for other elements and null", () => {
    expect(isTextEntry({ tagName: "INPUT" } as unknown as EventTarget)).toBe(true);
    expect(isTextEntry({ tagName: "TEXTAREA" } as unknown as EventTarget)).toBe(true);
    expect(isTextEntry({ tagName: "P" } as unknown as EventTarget)).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});

describe("isScreenshotShortcut", () => {
  it("counts PrintScreen and the real chords, by code so Shift does not matter", () => {
    expect(isScreenshotShortcut(key({ key: "PrintScreen" }))).toBe(true);
    expect(isScreenshotShortcut(key({ key: "$", code: "Digit4", metaKey: true, shiftKey: true }))).toBe(true);
    expect(isScreenshotShortcut(key({ key: "S", code: "KeyS", metaKey: true, shiftKey: true }))).toBe(true);
  });

  it("does not count a bare Cmd+Shift or an unrelated chord", () => {
    expect(isScreenshotShortcut(key({ key: "Shift", code: "ShiftLeft", metaKey: true, shiftKey: true }))).toBe(false);
    expect(isScreenshotShortcut(key({ key: "t", code: "KeyT", metaKey: true, shiftKey: true }))).toBe(false);
    expect(isScreenshotShortcut(key({ key: "4", code: "Digit4" }))).toBe(false);
  });
});

describe("registerCapture", () => {
  it("warns on the first attempt and ends the attempt on the second", () => {
    expect(registerCapture(0)).toMatchObject({ count: 1, shouldSubmit: false });
    expect(registerCapture(1)).toMatchObject({ count: 2, shouldSubmit: true });
  });

  it("treats a nonsensical negative tally as zero", () => {
    expect(registerCapture(-4).count).toBe(1);
  });
});
