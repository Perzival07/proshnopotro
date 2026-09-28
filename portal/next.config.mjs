import { fetchBrandingFromMaster, loadOrg, publicBranding, syncOrgPublic } from "./org-loader.mjs";

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
  // Every page here is personal and live, so the browser must not reuse a page
  // it visited a moment ago: by default Next keeps dynamic pages for 30 seconds
  // when moving between links, which showed a student the dashboard from before
  // their tutor assigned a test. (Prefetched pages get the same treatment.)
  experimental: {
    staleTimes: { dynamic: 0, static: 30 },
  },
  // The service worker must never be served stale, or a fix to it would not
  // reach installed apps until some cache happened to expire.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      // The face/phone models and the WebAssembly runtime are ~18 MB and never
      // change in place. By default files in public/ are revalidated on every
      // visit; cached for a year they cost Vercel bandwidth once per device
      // instead of once per exam. To ship a new model, give it a new file name.
      {
        source: "/proctor/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

/**
 * Which organisation this deployment serves (the ORG variable): its branding
 * from the master when connected, else from ../orgs/<ORG>/ (org-loader.mjs).
 * Its icons, favicon and offline page go into public/ before Next serves it.
 */
export default async function nextConfig() {
  await fetchBrandingFromMaster();
  const org = loadOrg();
  await syncOrgPublic(org);
  console.log(`[org] ${org.name} (${org.slug}), branding from ${org.source === "master" ? "the master" : `orgs/${org.slug}`}`);
  return {
    ...baseConfig,
    // Inlined into server and client code alike; read through lib/org.ts.
    env: { ORG_BRANDING: JSON.stringify(publicBranding(org)) },
  };
}
