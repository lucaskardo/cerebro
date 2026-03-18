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
          DEFAULT: "#1a1f36",
          50: "#f0f1f8",
          100: "#dde0f0",
          200: "#b8bfe1",
          300: "#8d97ce",
          400: "#6271bb",
          500: "#3f54a8",
          600: "#2e3f8a",
          700: "#1a1f36",
          800: "#141829",
          900: "#0e1020",
        },
        accent: {
          DEFAULT: "#0d9488",
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        gold: {
          DEFAULT: "#d4a853",
          50: "#fdf8ee",
          100: "#f9edcd",
          200: "#f3d98b",
          300: "#ecc454",
          400: "#d4a853",
          500: "#c49040",
          600: "#a97530",
          700: "#8a5b25",
          800: "#714a1e",
          900: "#5c3c19",
        },
        "bg-light": "#fafaf8",
        "bg-dark": "#111318",
        "card-light": "#ffffff",
        "card-dark": "#1c1f2a",
        "text-light": "#1a1f36",
        "text-dark": "#e8e6e1",
      },
      fontFamily: {
        serif: ["'Playfair Display'", "Georgia", "serif"],
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
