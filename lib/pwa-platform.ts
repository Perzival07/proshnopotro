/**
 * How this browser installs the portal as an app.
 *
 * Chromium browsers (Chrome, Edge, Brave, Opera, Samsung Internet) on Android,
 * Windows, macOS, Linux and ChromeOS fire `beforeinstallprompt`, so the page
 * can open the real install dialog itself. That event is handled at runtime;
 * this covers everything that does not fire it, where the most the page can do
 * is say which menu to use:
 *
 *   IOS             iPhone and iPad, in any browser: Share -> Add to Home Screen.
 *   MAC_SAFARI      Safari 17+ on macOS: File -> Add to Dock.
 *   ANDROID_MENU    Firefox and other Android browsers: menu -> Install.
 *   UNSUPPORTED     Firefox on desktop, older Safari: cannot install, so point
 *                   them at Chrome or Edge.
 *   PROMPT_ONLY     A Chromium browser. Offer the button only once the event
 *                   arrives -- it never comes when the app is already
 *                   installed, which is exactly when no offer should show.
 */
export type InstallPlatform =
  | "IOS"
  | "MAC_SAFARI"
  | "ANDROID_MENU"
  | "UNSUPPORTED"
  | "PROMPT_ONLY";

export function detectInstallPlatform(
  userAgent: string,
  maxTouchPoints: number = 0
): InstallPlatform {
  const ua = userAgent || "";

  // iPadOS 13+ reports itself as a Mac; the touch screen gives it away.
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (isIOS) return "IOS";

  const isAndroid = /Android/.test(ua);
  const isFirefox = /Firefox\/|FxiOS/.test(ua);
  const isChromium = /Chrome\/|Chromium\/|CriOS|Edg\//.test(ua);

  if (isAndroid) {
    // Samsung Internet carries "Chrome/" but installs from its own menu.
    if (isFirefox || /SamsungBrowser/.test(ua) || !isChromium) return "ANDROID_MENU";
    return "PROMPT_ONLY";
  }

  if (isFirefox) return "UNSUPPORTED";
  if (isChromium) return "PROMPT_ONLY";

  if (/Macintosh/.test(ua) && /Safari\//.test(ua)) {
    const version = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0);
    return version >= 17 ? "MAC_SAFARI" : "UNSUPPORTED";
  }

  return "UNSUPPORTED";
}

/** The steps shown where the page cannot open the install dialog itself. */
export const INSTALL_STEPS: Record<Exclude<InstallPlatform, "PROMPT_ONLY">, string> = {
  IOS: "Tap the Share button, then “Add to Home Screen”.",
  MAC_SAFARI: "In the menu bar, choose File → “Add to Dock”.",
  ANDROID_MENU: "Open the browser menu (⋮), then tap “Install” or “Add to Home screen”.",
  UNSUPPORTED: "Open this site in Google Chrome or Microsoft Edge to install it as an app.",
};

/** How long a dismissed install offer stays hidden. */
export const INSTALL_DISMISS_DAYS = 30;

export function isDismissalActive(
  dismissedAt: string | null,
  now: Date = new Date()
): boolean {
  if (!dismissedAt) return false;
  const at = Date.parse(dismissedAt);
  if (Number.isNaN(at)) return false;
  return now.getTime() - at < INSTALL_DISMISS_DAYS * 86_400_000;
}
