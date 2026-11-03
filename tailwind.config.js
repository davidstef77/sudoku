/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#000000",
        panel: "#0f0f0f",
        cell: "#1a1a1a",
        cellAlt: "#262626",
        accent: "#ffffff",
        accentSoft: "#d4d4d4",
        rose: "#f87171",
        good: "#4ade80",
        warn: "#fbbf24",
        muted: "#737373",
      },
      fontFamily: {
        display: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.25), 0 0 24px rgba(255,255,255,0.12)",
        card: "0 10px 30px -12px rgba(0,0,0,0.8)",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.75)", opacity: "0.4" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pop: "pop 140ms ease-out",
        fadeUp: "fadeUp 200ms ease-out",
      },
    },
  },
  plugins: [],
};
