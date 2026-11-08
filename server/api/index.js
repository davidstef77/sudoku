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
    console.error("[api] Conectarea la MongoDB a esuat:", error.message);
  });
}

ensureConnection();

const app = createApp();

export default app;
