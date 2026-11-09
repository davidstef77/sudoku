import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages publica site-ul sub /sudoku/, deci toate asset-urile
  // trebuie sa foloseasca acest prefix la build.
  base: "/sudoku/",
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    // In dezvoltare, cererile /api sunt proxy-uite catre backend-ul local.
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  // Configurare Vitest (npm test)
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "server/test/**/*.test.js"],
  },
});
