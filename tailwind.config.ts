import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette (from tutor logo)
        brand: {
          navy: "#0A4B8C",   // Headers, primary buttons, major titles
          blue: "#2E9CD8",   // Links, focus rings, interactive active states
          tint: "#E8F3FB",   // Thumbnail card backgrounds, table hover states
          page: "#F7F8FA",   // Main application background
          ink: "#1A2230",    // Primary body text
          border: "#DCE4EC", // Subtle hairline borders
        },
        // Strict Status Colors (Status only, never brand blue)
        status: {
          amber: {
            bg: "#FAEEDA",
            text: "#633806",
            border: "#F3DCB5",
          },
          green: {
            bg: "#E1F5EE",
            text: "#085041",
            border: "#C2EBDB",
          },
          gray: {
            bg: "#F1EFE8",
            text: "#444441",
            border: "#E2DFD6",
          },
        },
        // Semantic system tokens
        border: "#DCE4EC",
        input: "#DCE4EC",
        ring: "#2E9CD8",
        background: "#F7F8FA",
        foreground: "#1A2230",
        primary: {
          DEFAULT: "#0A4B8C",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#E8F3FB",
          foreground: "#0A4B8C",
        },
        muted: {
          DEFAULT: "#F1EFE8",
          foreground: "#5A6578",
        },
        accent: {
          DEFAULT: "#E8F3FB",
          foreground: "#0A4B8C",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
        heading: ["var(--font-poppins)", ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        body: ["0.9375rem", { lineHeight: "1.5rem" }], // 15px
        "body-lg": ["1rem", { lineHeight: "1.5rem" }],   // 16px
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(10, 75, 140, 0.05)",
        card: "0 1px 3px 0 rgba(10, 75, 140, 0.04), 0 1px 2px -1px rgba(10, 75, 140, 0.02)",
        "card-hover": "0 4px 12px 0 rgba(10, 75, 140, 0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
