import { describe, it, expect, vi } from "vitest";
import {
  CAMERA_CONSTRAINTS,
  cameraErrorMessage,
  isCameraLive,
  isCameraSupported,
  stopStream,
} from "./proctor-camera";

describe("CAMERA_CONSTRAINTS", () => {
  it("asks for the front camera and never the microphone", () => {
    expect(CAMERA_CONSTRAINTS.audio).toBe(false);
    expect(CAMERA_CONSTRAINTS.video).toMatchObject({ facingMode: "user" });
  });

  it("requests the small size as ideal, so an odd webcam still opens", () => {
    const video = CAMERA_CONSTRAINTS.video as MediaTrackConstraints;
    expect(video.width).toEqual({ ideal: 640 });
    expect(video.height).toEqual({ ideal: 480 });
  });
});

describe("isCameraSupported", () => {
  it("is true only when getUserMedia is actually callable", () => {
    expect(isCameraSupported({ mediaDevices: { getUserMedia: () => {} } } as never)).toBe(true);
    expect(isCameraSupported({ mediaDevices: {} } as never)).toBe(false);
    expect(isCameraSupported({} as never)).toBe(false);
    expect(isCameraSupported(undefined)).toBe(false);
    expect(isCameraSupported(null)).toBe(false);
  });
});

describe("cameraErrorMessage", () => {
  it("tells a student who denied it how to allow it", () => {
    expect(cameraErrorMessage({ name: "NotAllowedError" })).toMatch(/allow it in your browser/i);
  });

  it("distinguishes no camera from a camera in use", () => {
    expect(cameraErrorMessage({ name: "NotFoundError" })).toMatch(/no camera was found/i);
    expect(cameraErrorMessage({ name: "NotReadableError" })).toMatch(/already in use/i);
  });

  it("falls back to something actionable for anything else", () => {
    expect(cameraErrorMessage(new Error("boom"))).toMatch(/try again/i);
    expect(cameraErrorMessage(undefined)).toMatch(/try again/i);
    expect(cameraErrorMessage("nope")).toMatch(/try again/i);
  });
});

describe("isCameraLive", () => {
  it("is true only while the stream is actually running", () => {
    expect(isCameraLive("on")).toBe(true);
    expect(isCameraLive("starting")).toBe(false);
    expect(isCameraLive("blocked")).toBe(false);
    expect(isCameraLive("unsupported")).toBe(false);
    expect(isCameraLive("idle")).toBe(false);
  });
});

describe("stopStream", () => {
  it("stops every track, so the camera light really goes out", () => {
    const a = { stop: vi.fn() };
    const b = { stop: vi.fn() };
    stopStream({ getTracks: () => [a, b] });
    expect(a.stop).toHaveBeenCalledOnce();
    expect(b.stop).toHaveBeenCalledOnce();
  });

  it("keeps going when one track throws, and tolerates no stream at all", () => {
    const bad = {
      stop: vi.fn(() => {
        throw new Error("already ended");
      }),
    };
    const good = { stop: vi.fn() };
    expect(() => stopStream({ getTracks: () => [bad, good] })).not.toThrow();
    expect(good.stop).toHaveBeenCalledOnce();
    expect(() => stopStream(null)).not.toThrow();
  });
});
