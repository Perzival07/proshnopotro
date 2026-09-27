import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";
import { loadOrg, rgbOf } from "./org-loader.mjs";

const brand = loadOrg().colors;
const shadow = rgbOf(brand.navy);

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
        // Set per organisation in orgs/<ORG>/org.json.
        brand: {
          navy: brand.navy,     // Headers, primary buttons, major titles
          blue: brand.blue,     // Links, focus rings, interactive active states
          tint: brand.tint,     // Thumbnail card backgrounds, table hover states
          page: brand.page,     // Main application background
          ink: brand.ink,       // Primary body text
          border: brand.border, // Subtle hairline borders
          "on-dark": brand.onDark, // Light accent on navy / dark buttons
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
        border: brand.border,
        input: brand.border,
        ring: brand.blue,
        background: brand.page,
        foreground: brand.ink,
        primary: {
          DEFAULT: brand.navy,
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: brand.tint,
          foreground: brand.navy,
        },
        muted: {
          DEFAULT: "#F1EFE8",
          foreground: "#5A6578",
        },
        accent: {
          DEFAULT: brand.tint,
          foreground: brand.navy,
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
        xs: `0 1px 2px 0 rgba(${shadow}, 0.05)`,
        card: `0 1px 3px 0 rgba(${shadow}, 0.04), 0 1px 2px -1px rgba(${shadow}, 0.02)`,
        "card-hover": `0 4px 12px 0 rgba(${shadow}, 0.08)`,
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
