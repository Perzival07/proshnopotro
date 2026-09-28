/**
 * The organisation this deployment serves: its name, logo, colours, feature
 * switches and legal details.
 *
 * Runs in Node at build time only (next.config.mjs, tailwind.config.ts,
 * vitest.config.ts). The app itself never touches the file system for this:
 * next.config.mjs hands the public branding to the code as ORG_BRANDING.
 *
 * Where it comes from, in order:
 *   1. The master app, when the portal has MASTER_URL and MASTER_SYNC_SECRET:
 *      the super admin edits branding there, and saving it redeploys the
 *      portal. next.config.mjs fetches it (fetchBrandingFromMaster) into
 *      .org-cache/, which loadOrg() then reads -- tailwind.config.ts loads
 *      synchronously, so it cannot fetch for itself.
 *   2. ../orgs/<ORG>/org.json.
 *
 * syncOrgPublic() then writes the app icons, favicon and offline page into
 * public/ (git-ignored copies).
 */
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, "public");
/** The master's copy of the branding, fetched at build time (git-ignored). */
const CACHE_DIR = path.join(here, ".org-cache");
const CACHE_FILE = path.join(CACHE_DIR, "branding.json");
const CACHE_LOGO = path.join(CACHE_DIR, "logo");
/** Where an uploaded logo is served from; BrandMark and LogoBadge show it. */
export const LOGO_PATH = "/org-logo.png";

export const ORGS_DIR = path.resolve(here, "../orgs");
// The original single site. Keeping it the default means a deployment with
// no ORG set carries on exactly as before the repo was split.
export const DEFAULT_ORG = "classes-by-koustav";

const COLOR_KEYS = ["navy", "blue", "tint", "page", "ink", "border", "onDark"];

// What the manifest, the offline page and the browser tab point at, from an
// organisation folder's own public/.
const REQUIRED_PUBLIC_FILES = [
  "favicon.ico",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-192.png",
  "icons/maskable-512.png",
  "icons/apple-icon.png",
];

function checkSlug(slug) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`ORG="${slug}" is not a valid organisation slug`);
  }
}

/** Throws unless `org` has everything the portal needs. `from` names the source in the message. */
export function validateOrg(org, slug, from) {
  if (!org || typeof org !== "object") throw new Error(`${from} is not an organisation`);
  for (const key of ["slug", "name", "shortName", "logo", "tagline", "support", "colors", "features"]) {
    if (org[key] == null) throw new Error(`${from} is missing "${key}"`);
  }
  for (const key of COLOR_KEYS) {
    if (!/^#[0-9a-fA-F]{6}$/.test(org.colors[key] ?? "")) {
      throw new Error(`${from} needs colors.${key} as a #RRGGBB colour`);
    }
  }
  if (org.slug !== slug) {
    throw new Error(`${from} has slug "${org.slug}", expected "${slug}"`);
  }
  legalDetails(org.legal);
}

/**
 * The organisation's settings: the master's copy if next.config.mjs fetched
 * one for this slug, else orgs/<slug>/org.json. `{ cache: false }` reads the
 * folder only (the tests do, so they never depend on a local fetch).
 */
export function loadOrg(slug = process.env.ORG || DEFAULT_ORG, { cache = true } = {}) {
  checkSlug(slug);
  if (cache && fs.existsSync(CACHE_FILE)) {
    const cached = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    if (cached.slug === slug) {
      validateOrg(cached, slug, "The branding from the master");
      return { ...cached, source: "master", logoFile: fs.existsSync(CACHE_LOGO) ? CACHE_LOGO : null };
    }
  }
  const file = path.join(ORGS_DIR, slug, "org.json");
  if (!fs.existsSync(file)) {
    throw new Error(
      `ORG="${slug}" has no branding: ${file} does not exist and none was fetched from the master ` +
        "(set MASTER_URL and MASTER_SYNC_SECRET, and save its branding in the master)"
    );
  }
  const org = JSON.parse(fs.readFileSync(file, "utf8"));
  validateOrg(org, slug, file);
  return { ...org, source: "folder", logoFile: null };
}

/** The same signature as lib/master-signature.ts (and master/lib/signature.ts). */
function sign(secret, method, pathname) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${method}.${pathname}.`).digest("hex");
  return `t=${t},v1=${v1}`;
}

/**
 * Asks the master for this organisation's branding and keeps it in
 * .org-cache/ for loadOrg(). Without MASTER_URL and MASTER_SYNC_SECRET, or
 * when the master has no branding saved for it, the cache is cleared and the
 * orgs/ folder is used. If the master cannot be reached, the folder is used
 * when there is one; otherwise the build stops, since it has nothing to show.
 */
export async function fetchBrandingFromMaster(slug = process.env.ORG || DEFAULT_ORG) {
  checkSlug(slug);
  const url = process.env.MASTER_URL?.replace(/\/+$/, "");
  const secret = process.env.MASTER_SYNC_SECRET;
  const clear = () => fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  if (!url || !secret) {
    clear();
    return "folder";
  }
  const pathname = `/api/portal/${slug}/branding`;
  const hasFolder = fs.existsSync(path.join(ORGS_DIR, slug, "org.json"));
  let res;
  try {
    res = await fetch(`${url}${pathname}`, {
      headers: { "x-proshnopotro-signature": sign(secret, "GET", pathname) },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    res = { ok: false, status: `unreachable (${err instanceof Error ? err.message : err})` };
  }
  if (res.status === 404) {
    clear();
    return "folder";
  }
  if (!res.ok) {
    clear();
    const why = `could not fetch branding from the master: ${res.status}`;
    if (hasFolder) {
      console.warn(`[org] ${why}; using orgs/${slug}/org.json`);
      return "folder";
    }
    throw new Error(`[org] ${why}, and there is no orgs/${slug}/org.json to fall back on`);
  }
  const { logoImage, ...branding } = await res.json();
  validateOrg(branding, slug, "The branding from the master");
  clear();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(branding, null, 2));
  if (logoImage?.base64) fs.writeFileSync(CACHE_LOGO, Buffer.from(logoImage.base64, "base64"));
  return "master";
}

/**
 * Who the privacy notice and terms name (orgs/<ORG>/org.json "legal"). Every
 * field may be missing: the pages then show the gap and a draft banner.
 */
function legalDetails(legal = {}) {
  const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const effectiveDate = text(legal.effectiveDate);
  if (effectiveDate && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    throw new Error(`legal.effectiveDate must be YYYY-MM-DD, not "${effectiveDate}"`);
  }
  return {
    entityName: text(legal.entityName),
    address: text(legal.address),
    city: text(legal.city),
    grievanceOfficer: { name: text(legal.grievanceOfficer?.name), email: text(legal.grievanceOfficer?.email) },
    effectiveDate,
  };
}

/** The part of the organisation's settings that is safe to ship to browsers. */
export function publicBranding(org) {
  const { slug, name, shortName, logo, tagline, support, colors, features } = org;
  return {
    slug,
    name,
    shortName,
    logo,
    tagline,
    support,
    colors,
    features,
    legal: legalDetails(org.legal),
    hasLogoImage: Boolean(org.logoFile),
  };
}

/**
 * Writes this organisation's app icons, favicon and offline page into
 * public/, from, in order: the logo uploaded in the master (icons made from
 * it, and the logo itself at LOGO_PATH), the orgs/<ORG>/public folder, or the
 * atom mark in the organisation's colours. Files are only written when they
 * differ, so a running dev server does not see a change on every restart.
 */
export async function syncOrgPublic(org) {
  const folder = path.join(ORGS_DIR, org.slug, "public");
  const logoOut = path.join(PUBLIC_DIR, LOGO_PATH);
  if (org.logoFile) {
    const { default: sharp } = await import("sharp");
    const logo = fs.readFileSync(org.logoFile);
    writeIfChanged(logoOut, await sharp(logo).resize(512, 512, { fit: "inside", withoutEnlargement: true }).png().toBuffer());
    await writeIcons((kind, size) => logoIcon(sharp, logo, kind, size));
  } else {
    fs.rmSync(logoOut, { force: true });
    if (fs.existsSync(folder)) {
      for (const icon of REQUIRED_PUBLIC_FILES) {
        if (!fs.existsSync(path.join(folder, icon))) throw new Error(`orgs/${org.slug}/public/${icon} is missing`);
      }
      for (const rel of listFiles(folder)) {
        writeIfChanged(path.join(PUBLIC_DIR, rel), fs.readFileSync(path.join(folder, rel)));
      }
    } else {
      const { default: sharp } = await import("sharp");
      await writeIcons((kind, size) => sharp(Buffer.from(atomIcon(org.colors, kind))).resize(size, size).png().toBuffer());
    }
  }
  writeIfChanged(path.join(PUBLIC_DIR, "offline.html"), Buffer.from(offlinePage(org)));
}

/** The icon set the manifest and layout link to, plus a favicon made from the 32px one. */
async function writeIcons(render) {
  const sets = [
    ["icons/icon-192.png", "any", 192],
    ["icons/icon-512.png", "any", 512],
    ["icons/maskable-192.png", "maskable", 192],
    ["icons/maskable-512.png", "maskable", 512],
    // iOS rounds the corners itself, so this one is full-bleed with no transparency.
    ["icons/apple-icon.png", "maskable", 180],
  ];
  for (const [file, kind, size] of sets) writeIfChanged(path.join(PUBLIC_DIR, file), await render(kind, size));
  writeIfChanged(path.join(PUBLIC_DIR, "favicon.ico"), icoFromPng(await render("any", 32)));
}

/**
 * An uploaded logo as an app icon: centred on white, inside the safe zone.
 * "any" is a rounded tile with transparent corners; "maskable" is full-bleed
 * so a phone can crop it to its own shape without clipping the logo.
 */
async function logoIcon(sharp, logo, kind, size) {
  const inner = Math.round(size * (kind === "any" ? 0.78 : 0.62));
  const mark = await sharp(logo)
    .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  const radius = kind === "any" ? Math.round(size * 0.21) : 0;
  const tile = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#FFFFFF"/></svg>`
  );
  return sharp(tile).composite([{ input: mark, gravity: "centre" }]).png().toBuffer();
}

/** The atom mark on the organisation's navy, as drawn by scripts/generate-app-icons.mjs. */
function atomIcon({ navy, blue }, kind) {
  const atom = (size, offset) => {
    const s = size / 100;
    const orbit = `<ellipse cx="50" cy="50" rx="15" ry="36" stroke="${navy}" stroke-width="3.8" fill="none" />`;
    return `<g transform="translate(${offset} ${offset}) scale(${s})">
      <circle cx="50" cy="50" r="8" fill="${blue}" />${orbit}
      <g transform="rotate(60 50 50)">${orbit}<circle cx="50" cy="14" r="5" fill="${blue}" /></g>
      <g transform="rotate(-60 50 50)">${orbit}<circle cx="50" cy="86" r="5" fill="${blue}" /></g>
      <circle cx="35" cy="50" r="5" fill="${blue}" /></g>`;
  };
  return kind === "any"
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
        <rect x="16" y="16" width="480" height="480" rx="108" fill="${navy}" />
        <circle cx="256" cy="256" r="178" fill="#FFFFFF" stroke="${blue}" stroke-width="10" />${atom(290, 111)}</svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
        <rect width="512" height="512" fill="${navy}" />
        <circle cx="256" cy="256" r="150" fill="#FFFFFF" stroke="${blue}" stroke-width="8" />${atom(240, 136)}</svg>`;
}

/** A one-image .ico holding a PNG, which every current browser reads. */
function icoFromPng(png) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(32, 6); // width
  header.writeUInt8(32, 7); // height
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18); // image data offset
  return Buffer.concat([header, png]);
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
