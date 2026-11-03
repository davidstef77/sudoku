/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0b14",
        panel: "#16162a",
        cell: "#1f1f38",
        cellAlt: "#252544",
        accent: "#7ee0f0",
        accentSoft: "#9be8f5",
        rose: "#ff8fb1",
        good: "#5ee0a0",
        warn: "#ffd166",
        muted: "#8a8aa3",
      },
      fontFamily: {
        display: ["'Segoe UI'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(126,224,240,0.35), 0 0 24px rgba(126,224,240,0.25)",
        card: "0 10px 30px -12px rgba(0,0,0,0.7)",
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
