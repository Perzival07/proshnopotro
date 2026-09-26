import { defineConfig } from "vitest/config";
import path from "path";
import { loadOrg, publicBranding } from "./org-loader.mjs";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    // Run as production does. Vercel's runtime is UTC while developers are on
    // IST, so a missing `timeZone` option looks correct locally and renders
    // deadlines 5.5 hours early once deployed. Forcing UTC here means the
    // date tests actually guard against that.
    env: { TZ: "UTC", ORG_BRANDING: JSON.stringify(publicBranding(loadOrg())) },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
