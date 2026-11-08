/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Toate culorile semantice vin din variabile CSS (index.css),
        // ca tema light/dark sa se schimbe instant, fara reload.
        // Spre deosebire de valori fixe, aici "alb/negru" sunt relative la tema.
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        panel: "rgb(var(--c-panel) / <alpha-value>)",
        cell: "rgb(var(--c-cell) / <alpha-value>)",
        cellAlt: "rgb(var(--c-cellAlt) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        accentDeep: "rgb(var(--c-accentDeep) / <alpha-value>)",
        accentStrong: "rgb(var(--c-accentStrong) / <alpha-value>)",
        accentSoft: "rgb(var(--c-accentSoft) / <alpha-value>)",
        rose: "rgb(var(--c-rose) / <alpha-value>)",
        good: "rgb(var(--c-good) / <alpha-value>)",
        warn: "rgb(var(--c-warn) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        // "white" este folosit intens in componente ca text/borduri —
        // il pastram semantic: alb in tema dark, aproape-negru in light.
        white: "rgb(var(--c-surface) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        heading: ['"Space Grotesk"', "Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--c-glow-ring) / 0.3), 0 0 24px rgb(var(--c-glow-ring) / 0.15)",
        card: "0 12px 32px -12px rgb(var(--c-card-shadow) / 0.7)",
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
        toastIn: {
          "0%": { opacity: "0", transform: "translateX(24px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(200%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        pop: "pop 140ms ease-out",
        fadeUp: "fadeUp 200ms ease-out",
        toastIn: "toastIn 260ms cubic-bezier(0.21, 1.02, 0.73, 1) both",
        shimmer: "shimmer 2.4s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
