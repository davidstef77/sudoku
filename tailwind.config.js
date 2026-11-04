/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta ceruta: negru, albastru inchis, alb (+ rosu doar pentru greseli).
        ink: "#000000",
        panel: "#0a1430",
        cell: "#0e1e4a",
        cellAlt: "#17306e",
        // Alb ca accent (butoane, selectie, evidentiere).
        accent: "#ffffff",
        accentDeep: "#dbe6ff",
        accentStrong: "#a9bdf0",
        accentSoft: "#c9d6f5",
        // Doar pentru greseli / conflicte.
        rose: "#f87171",
        // Pastrate doar pentru jocul bonus Turing Test (Mastermind cu culori).
        good: "#34d399",
        warn: "#fbbf24",
        // Text secundar: albastru dezacturat.
        muted: "#8fa0c9",
      },
      fontFamily: {
        display: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.3), 0 0 24px rgba(255,255,255,0.15)",
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
