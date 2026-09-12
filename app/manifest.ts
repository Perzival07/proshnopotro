import type { MetadataRoute } from "next";

/**
 * The web app manifest: what makes the portal installable from Chrome and
 * Edge (Android, Windows, macOS, Linux, ChromeOS), Safari on Mac (Add to
 * Dock) and iPhone/iPad (Add to Home Screen), and how the installed app looks.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Classes by Koustav",
    short_name: "Koustav",
    description: "Take your assigned tests and upload your answers for Classes by Koustav.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F7F8FA",
    theme_color: "#0A4B8C",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
