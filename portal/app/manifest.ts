import type { MetadataRoute } from "next";
import { org } from "@/lib/org";

/**
 * The web app manifest: what makes the portal installable from Chrome and
 * Edge (Android, Windows, macOS, Linux, ChromeOS), Safari on Mac (Add to
 * Dock) and iPhone/iPad (Add to Home Screen), and how the installed app looks.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: org.name,
    short_name: org.shortName,
    description: `Take your assigned tests and upload your answers for ${org.name}.`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: org.colors.page,
    theme_color: org.colors.navy,
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
