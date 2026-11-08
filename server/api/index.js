/**
 * Punct de intrare serverless pentru Vercel.
 *
 * Diferenta fata de serverul clasic: nu exista "index.js" care sa porneasca
 * o data, deci conexiunea Mongoose trebuie initiată aici, la prima invocatie,
 * si refolosita intre invocatiile "calde" ale aceleiasi instante.
 */

import mongoose from "mongoose";
import { createApp } from "../src/app.js";

// Conexiunea e creata o singura data per instanta (modulo cold start).
let connectionPromise = null;

function ensureConnection() {
  // 0 = deconectat, 1 = conectat, 2 = se conecteaza, 3 = deconecteaza.
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return;
  }

  connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
    maxPoolSize: 10, // pool reutilizat intre invocatii "calde"
    minPoolSize: 1,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 30000,
    family: 4,
    // Cererile asteapta conexiunea pana la 30s (cold start + TLS la Atlas).
    bufferTimeoutMS: 30000,
  });

  connectionPromise.catch((error) => {
    // Log detaliat: ce spune FIECARE server din cluster (DNS vs TCP vs TLS vs auth).
    const servers = {};
    for (const [host, detail] of Object.entries(error.errors ?? {})) {
      servers[host] = {
        code: detail.code,
        codeName: detail.codeName,
        message: String(detail.message || "").slice(0, 200),
      };
    }
    console.error(
      "[api] Conectarea la MongoDB a esuat:",
      JSON.stringify(
        {
          name: error.name,
          message: String(error.message || "").slice(0, 300),
          code: error.code,
          codeName: error.codeName,
          errorLabels: error.errorLabels,
          servers,
        },
        null,
        0
      )
    );
  });
}

ensureConnection();

const app = createApp();

export default app;
