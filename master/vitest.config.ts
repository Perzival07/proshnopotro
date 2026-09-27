import path from "node:path";
import { defineConfig } from "vitest/config";

process.env.TZ = "UTC";

export default defineConfig({
  test: { include: ["lib/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname) } },
});
