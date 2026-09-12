"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Makes the portal installable, and keeps hold of the browser's install offer.
 *
 * Chromium fires `beforeinstallprompt` once, early, and only to listeners that
 * already exist -- so it is captured here, in a component mounted by the root
 * layout, rather than by whichever install button happens to render later.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
let listening = false;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => fn());
}

function startListening() {
  if (listening || typeof window === "undefined") return;
  listening = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    // Hold the offer for our own button instead of Chrome's mini-infobar.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

// As early as the module loads on the client, not on first effect.
startListening();

export interface InstallPromptState {
  /** The browser can open its own install dialog. */
  canPrompt: boolean;
  /** Installed during this visit. */
  installed: boolean;
}

let snapshot: InstallPromptState = { canPrompt: false, installed: false };
const serverSnapshot: InstallPromptState = { canPrompt: false, installed: false };

function getSnapshot(): InstallPromptState {
  const next = { canPrompt: deferredPrompt !== null, installed };
  if (next.canPrompt !== snapshot.canPrompt || next.installed !== snapshot.installed) {
    snapshot = next;
  }
  return snapshot;
}

export function useInstallPrompt(): InstallPromptState {
  return useSyncExternalStore(
    (fn) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    getSnapshot,
    () => serverSnapshot
  );
}

/** Opens the browser's install dialog. Resolves true when the user accepts. */
export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt;
  if (!event) return false;
  // The event can only be used once, whatever the answer.
  deferredPrompt = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === "accepted";
}

/** Whether the page is already running as the installed app. */
export function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Registers the service worker. Production only: in development it would
 * serve a cached offline page over the dev server's own reloads.
 */
export function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
