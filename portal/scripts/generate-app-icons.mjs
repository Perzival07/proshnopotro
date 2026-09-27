/**
 * Renders the installed-app icons from the atom mark.
 *
 *   ORG=<slug> node scripts/generate-app-icons.mjs
 *
 * Writes into orgs/<ORG>/public/icons in that organisation's navy and blue
 * (the build copies them into public/). Needs Google Chrome installed
 * (puppeteer-core drives it). Re-run whenever the logo or colours change,
 * then bump VERSION in public/sw.js. An organisation with its own logo
 * can skip this and drop its own PNGs into that folder instead.
 *
 * Two shapes are produced:
 *   any       - a rounded navy tile with transparent corners, used as-is by
 *               desktops (Windows, macOS, Linux) and browser tabs.
 *   maskable  - a full-bleed navy square with the mark inside the central
 *               safe zone, so Android and iOS can crop it to their own
 *               circle or squircle without clipping the logo.
 */
import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";
import { ORGS_DIR, loadOrg } from "../org-loader.mjs";

const CHROME_PATH =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const org = loadOrg();
const ROOT = path.join(ORGS_DIR, org.slug, "public");

const NAVY = org.colors.navy;
const BLUE = org.colors.blue;

function atom(size, offset) {
  const s = size / 100;
  return `
    <g transform="translate(${offset} ${offset}) scale(${s})">
      <circle cx="50" cy="50" r="8" fill="${BLUE}" />
      <ellipse cx="50" cy="50" rx="15" ry="36" stroke="${NAVY}" stroke-width="3.8" fill="none" />
      <g transform="rotate(60 50 50)">
        <ellipse cx="50" cy="50" rx="15" ry="36" stroke="${NAVY}" stroke-width="3.8" fill="none" />
        <circle cx="50" cy="14" r="5" fill="${BLUE}" />
      </g>
      <g transform="rotate(-60 50 50)">
        <ellipse cx="50" cy="50" rx="15" ry="36" stroke="${NAVY}" stroke-width="3.8" fill="none" />
        <circle cx="50" cy="86" r="5" fill="${BLUE}" />
      </g>
      <circle cx="35" cy="50" r="5" fill="${BLUE}" />
    </g>`;
}

/** All artwork is drawn on a 512 canvas and scaled by the browser. */
function svg(kind) {
  if (kind === "any") {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
        <rect x="16" y="16" width="480" height="480" rx="108" fill="${NAVY}" />
        <circle cx="256" cy="256" r="178" fill="#FFFFFF" stroke="${BLUE}" stroke-width="10" />
        ${atom(290, 111)}
      </svg>`;
  }
  // maskable: the safe zone is the central circle of radius 40% (205px).
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="${NAVY}" />
      <circle cx="256" cy="256" r="150" fill="#FFFFFF" stroke="${BLUE}" stroke-width="8" />
      ${atom(240, 136)}
    </svg>`;
}

const OUTPUTS = [
  { file: "icons/icon-192.png", kind: "any", size: 192 },
  { file: "icons/icon-512.png", kind: "any", size: 512 },
  { file: "icons/maskable-192.png", kind: "maskable", size: 192 },
  { file: "icons/maskable-512.png", kind: "maskable", size: 512 },
  // What iOS uses for Add to Home Screen (app/layout.tsx links it). iOS
  // rounds the corners itself, so it must be full-bleed with no transparency.
  { file: "icons/apple-icon.png", kind: "maskable", size: 180 },
];

const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: "new" });
try {
  const page = await browser.newPage();
  for (const { file, kind, size } of OUTPUTS) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">
         <div style="width:${size}px;height:${size}px">${svg(kind).replace("<svg ", `<svg width="${size}" height="${size}" `)}</div>
       </body></html>`
    );
    const out = path.join(ROOT, file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log("wrote", path.relative(process.cwd(), out));
  }
} finally {
  await browser.close();
}
