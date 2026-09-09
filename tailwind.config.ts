import type { Config } from "tailwindcss";

// Design tokens live as CSS variables in app/globals.css so light/dark
// mode is a class toggle, not a duplicated Tailwind theme. This file
// just gives them Tailwind-friendly names: bg-surface, text-text-2,
// border-border, etc.

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        border: "var(--border)",
        "text-1": "var(--text-1)",
        "text-2": "var(--text-2)",
        "text-3": "var(--text-3)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        "accent-text": "var(--accent-text)",
        positive: "var(--positive)",
        "positive-soft": "var(--positive-soft)",
        warn: "var(--warn)",
        "warn-soft": "var(--warn-soft)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "10px",
        md: "16px",
        lg: "22px",
      },
    },
  },
  plugins: [],
};

export default config;
