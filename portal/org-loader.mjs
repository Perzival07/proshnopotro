/**
 * Reads the organisation this deployment serves from ../orgs/<ORG>/org.json.
 *
 * Runs in Node at build time only (next.config.mjs, tailwind.config.ts,
 * vitest.config.ts). The app itself never touches the file system for this:
 * next.config.mjs hands the public branding to the code as ORG_BRANDING.
 * Billing and limits stay here, so they never reach a browser bundle.
 *
 * The organisation's own files -- app icons and favicon, in orgs/<ORG>/public
 * -- are copied into portal/public by syncOrgPublic(), along with an offline
 * page in its colours. Those copies are git-ignored; orgs/ is the source.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, "public");

export const ORGS_DIR = path.resolve(here, "../orgs");
// The original single site. Keeping it the default means a deployment with
// no ORG set carries on exactly as before the repo was split.
export const DEFAULT_ORG = "classes-by-koustav";

const COLOR_KEYS = ["navy", "blue", "tint", "page", "ink", "border", "onDark"];

// What the manifest, the offline page and the browser tab point at.
const REQUIRED_PUBLIC_FILES = [
  "favicon.ico",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-192.png",
  "icons/maskable-512.png",
];

export function loadOrg(slug = process.env.ORG || DEFAULT_ORG) {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`ORG="${slug}" is not a valid organisation folder name`);
  }
  const file = path.join(ORGS_DIR, slug, "org.json");
  if (!fs.existsSync(file)) {
    throw new Error(`ORG="${slug}" but ${file} does not exist`);
  }
  const org = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const key of ["slug", "name", "shortName", "logo", "tagline", "support", "colors", "features"]) {
    if (org[key] == null) throw new Error(`${file} is missing "${key}"`);
  }
  for (const key of COLOR_KEYS) {
    if (!/^#[0-9a-fA-F]{6}$/.test(org.colors[key] ?? "")) {
      throw new Error(`${file} needs colors.${key} as a #RRGGBB colour`);
    }
  }
  for (const icon of REQUIRED_PUBLIC_FILES) {
    if (!fs.existsSync(path.join(ORGS_DIR, slug, "public", icon))) {
      throw new Error(`orgs/${slug}/public/${icon} is missing`);
    }
  }
  if (org.slug !== slug) {
    throw new Error(`${file} has slug "${org.slug}", expected "${slug}"`);
  }
  return org;
}

/** The part of the organisation's settings that is safe to ship to browsers. */
export function publicBranding(org) {
  const { slug, name, shortName, logo, tagline, support, colors, features } = org;
  return { slug, name, shortName, logo, tagline, support, colors, features };
}

/**
 * Copies orgs/<ORG>/public into portal/public and writes public/offline.html
 * for this organisation. Files are only written when they differ, so a
 * running dev server does not see a change on every restart.
 */
export function syncOrgPublic(org) {
  const source = path.join(ORGS_DIR, org.slug, "public");
  for (const rel of listFiles(source)) {
    writeIfChanged(path.join(PUBLIC_DIR, rel), fs.readFileSync(path.join(source, rel)));
  }
  writeIfChanged(path.join(PUBLIC_DIR, "offline.html"), Buffer.from(offlinePage(org)));
}

function listFiles(dir, prefix = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(prefix, entry.name);
    if (entry.name.startsWith(".")) return [];
    return entry.isDirectory() ? listFiles(path.join(dir, entry.name), rel) : [rel];
  });
}

function writeIfChanged(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file).equals(content)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

/** "#0A4B8C" -> "10, 75, 140", for rgba() shadows in the brand colour. */
export function rgbOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * The page the service worker shows when the portal cannot be reached. It is
 * served without the app, so it carries its own styles.
 */
function offlinePage(org) {
  const { navy, page, border } = org.colors;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="${navy}" />
  <title>You're offline | ${escapeHtml(org.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      background: ${page};
      color: #1F2937;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    .card {
      width: 100%;
      max-width: 380px;
      background: #fff;
      border: 1px solid ${border};
      border-radius: 16px;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(${rgbOf(navy)}, 0.08);
    }
    img { width: 64px; height: 64px; border-radius: 16px; }
    h1 { margin: 16px 0 8px; font-size: 20px; color: ${navy}; }
    p { margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #4B5563; }
    button {
      width: 100%;
      padding: 12px 16px;
      border: 0;
      border-radius: 10px;
      background: ${navy};
      color: #fff;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { filter: brightness(0.9); }
  </style>
</head>
<body>
  <main class="card">
    <img src="/icons/icon-192.png" alt="" />
    <h1>You're offline</h1>
    <p>This app needs an internet connection. Check your Wi-Fi or mobile data, then try again. A running test timer keeps going while you're away.</p>
    <button type="button" onclick="location.reload()">Try again</button>
  </main>
  <script>
    window.addEventListener("online", function () { location.reload(); });
  </script>
</body>
</html>
`;
}
