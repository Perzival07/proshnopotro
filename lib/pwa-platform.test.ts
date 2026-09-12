import { describe, it, expect } from "vitest";
import { detectInstallPlatform, isDismissalActive, INSTALL_DISMISS_DAYS } from "./pwa-platform";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  ipadAsMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  macSafari17:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  macSafari16:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.68",
  linuxChrome:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  windowsFirefox:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
};

describe("detectInstallPlatform", () => {
  it("sends every iPhone browser to Add to Home Screen", () => {
    expect(detectInstallPlatform(UA.iphoneSafari)).toBe("IOS");
    expect(detectInstallPlatform(UA.iphoneChrome)).toBe("IOS");
  });

  it("recognises an iPad that reports itself as a Mac", () => {
    expect(detectInstallPlatform(UA.ipadAsMac, 5)).toBe("IOS");
  });

  it("uses Add to Dock on Safari 17+ for Mac", () => {
    expect(detectInstallPlatform(UA.macSafari17, 0)).toBe("MAC_SAFARI");
  });

  it("points older Mac Safari elsewhere", () => {
    expect(detectInstallPlatform(UA.macSafari16, 0)).toBe("UNSUPPORTED");
  });

  it("waits for the native prompt on Chromium desktops", () => {
    expect(detectInstallPlatform(UA.macChrome)).toBe("PROMPT_ONLY");
    expect(detectInstallPlatform(UA.windowsEdge)).toBe("PROMPT_ONLY");
    expect(detectInstallPlatform(UA.linuxChrome)).toBe("PROMPT_ONLY");
  });

  it("waits for the native prompt on Android Chrome", () => {
    expect(detectInstallPlatform(UA.androidChrome, 5)).toBe("PROMPT_ONLY");
  });

  it("uses the browser menu on other Android browsers", () => {
    expect(detectInstallPlatform(UA.androidFirefox, 5)).toBe("ANDROID_MENU");
    expect(detectInstallPlatform(UA.androidSamsung, 5)).toBe("ANDROID_MENU");
  });

  it("points desktop Firefox at Chrome or Edge", () => {
    expect(detectInstallPlatform(UA.windowsFirefox)).toBe("UNSUPPORTED");
  });
});

describe("isDismissalActive", () => {
  const now = new Date("2026-09-13T12:00:00.000Z");

  it("is inactive when never dismissed", () => {
    expect(isDismissalActive(null, now)).toBe(false);
  });

  it("hides the offer for the dismissal period", () => {
    expect(isDismissalActive("2026-09-01T12:00:00.000Z", now)).toBe(true);
  });

  it("offers again after the period", () => {
    const past = new Date(now.getTime() - (INSTALL_DISMISS_DAYS + 1) * 86_400_000);
    expect(isDismissalActive(past.toISOString(), now)).toBe(false);
  });

  it("ignores a corrupted value", () => {
    expect(isDismissalActive("not a date", now)).toBe(false);
  });
});
