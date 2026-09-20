/** @type {import('next').NextConfig} */
const nextConfig = {
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

export default nextConfig;
