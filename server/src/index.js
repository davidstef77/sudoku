/**
 * Punctul de intrare al serverului.
 * Ordinea de pornire: configurare -> conectare DB -> listen -> shutdown curat.
 */

import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./db/connect.js";

async function main() {
  // Serverul clasic porneste DOAR cu baza conectata (fail fast la configurare gresita).
  await connectDatabase();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[api] Server pornit pe http://localhost:${env.port}`);
  });

  // ---------- shutdown curat (SIGTERM din Docker/PM2, Ctrl+C in dev) ----------
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[api] ${signal} primit — închid curat...`);

    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });

    // Fallback daca conexiunile active nu se inchid la timp.
    setTimeout(() => {
      console.error("[api] Shutdown forțat după 10s.");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("[api] Pornirea a eșuat:", error.message);
  process.exit(1);
});
