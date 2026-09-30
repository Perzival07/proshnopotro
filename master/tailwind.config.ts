import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Indigo into blue, with a warm accent for highlights.
        brand: {
          50: "#f3f4ff",
          100: "#e6e8ff",
          200: "#cdd1ff",
          300: "#a8aefc",
          400: "#7f85fb",
          500: "#585df9",
          600: "#4540e6",
          700: "#3730c2",
          800: "#2c2a8f",
          900: "#1e1e4b",
          950: "#12122e",
        },
        sky: {
          500: "#0083e0",
          600: "#0064b8",
        },
        accent: {
          50: "#fff7ee",
          400: "#ffac3f",
          500: "#f29000",
          600: "#d67600",
        },
        ink: "#101828",
        // The public site's dark theme (app/page.tsx).
        // A deep indigo navy rather than near-black, so the page reads lighter.
        night: {
          700: "#343a63",
          800: "#282d52",
          900: "#1f2346",
          950: "#191c3b",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-geist)", "var(--font-jakarta)", ...defaultTheme.fontFamily.sans],
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        tick: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "node-pulse": {
          "0%": { transform: "scale(1)", opacity: "0.55" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        "node-pulse": "node-pulse 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        float: "float 6s ease-in-out infinite",
        tick: "tick 1s steps(1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
