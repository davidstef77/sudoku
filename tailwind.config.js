/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Fundal si suprafete: bleumarin inchis, nu negru pur.
        ink: "#070b14",
        panel: "#0e1628",
        cell: "#16213a",
        cellAlt: "#223050",
        // Accent indigo: butoane, selectie, evidentiere cifre.
        accent: "#818cf8",
        accentDeep: "#6366f1",
        accentStrong: "#c7d2fe",
        // Text secundar / cifre introduse de jucator.
        accentSoft: "#cbd5e1",
        // Culori de stare.
        rose: "#fb7185",
        good: "#34d399",
        warn: "#fbbf24",
        muted: "#7b8aa3",
      },
      fontFamily: {
        display: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(129,140,248,0.35), 0 0 28px rgba(129,140,248,0.25)",
        card: "0 12px 32px -12px rgba(0,0,0,0.7)",
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
