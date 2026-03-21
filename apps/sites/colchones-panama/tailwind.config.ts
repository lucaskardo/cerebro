import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2D3561",
          50: "#eef0f8",
          100: "#d5d9ed",
          200: "#aab3db",
          300: "#7f8dc9",
          400: "#5567b7",
          500: "#3d50a4",
          600: "#2D3561",
          700: "#232a4d",
          800: "#1a1f3a",
          900: "#111426",
        },
        accent: {
          DEFAULT: "#8B7FB5",
          50: "#f4f2f9",
          100: "#e8e4f3",
          200: "#d1c9e7",
          300: "#baaedb",
          400: "#9d92c9",
          500: "#8B7FB5",
          600: "#7464a0",
          700: "#5d4f82",
          800: "#463a64",
          900: "#2f2646",
        },
        gold: {
          DEFAULT: "#C8A96E",
          50: "#faf6ee",
          100: "#f3e9d2",
          200: "#e7d3a5",
          300: "#dabd78",
          400: "#C8A96E",
          500: "#b88f4e",
          600: "#9a7238",
          700: "#7b5828",
          800: "#5d4019",
          900: "#3f2b0f",
        },
        lavender: "#8B7FB5",
        indigo: "#2D3561",
        cream: "#F5F0EB",
        "bg-light": "#F5F0EB",
        "bg-dark": "#111318",
        "card-light": "#ffffff",
        "card-dark": "#1c1f2a",
        "text-light": "#2D3561",
        "text-dark": "#e8e6e1",
      },
      fontFamily: {
        serif: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "none",
            color: "#374151",
            "h2, h3": { color: "#1a1f36", fontFamily: "'Playfair Display', Georgia, serif" },
            a: { color: "#0d9488", textDecoration: "none", "&:hover": { textDecoration: "underline" } },
            blockquote: { borderLeftColor: "#0d9488", backgroundColor: "#f0fdfa", padding: "0.5rem 1rem", borderRadius: "0 0.5rem 0.5rem 0" },
            "blockquote p": { marginTop: "0", marginBottom: "0" },
          },
        },
        invert: {
          css: {
            color: "#e8e6e1",
            "h2, h3": { color: "#e8e6e1" },
            a: { color: "#2dd4bf" },
            blockquote: { borderLeftColor: "#0d9488", backgroundColor: "#0f2827" },
          },
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
