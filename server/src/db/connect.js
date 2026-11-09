/**
 * Conexiunea la MongoDB Atlas — folosita IDENTIC de serverul clasic
 * (src/index.js) si de functia serverless Vercel (api/index.js).
 *
 *   - promisiunea de conectare e memorata: invocatiile "calde" o refolosesc;
 *   - daca o conectare esueaza, promisiunea e uitata si urmatoarea cerere
 *     reincearca (inainte, pe Vercel, o instanta cu conectarea esuata la
 *     cold start ramanea moarta pana la reciclare);
 *   - bufferCommands dezactivat: fara conexiune, cererea pica imediat cu 503
 *     in loc sa astepte 30s (mai mult decat timeout-ul functiei Vercel).
 */

import mongoose from "mongoose";
import { env } from "../config/env.js";

mongoose.set("strictQuery", true);
mongoose.set("bufferCommands", false);

let connectPromise = null;
let listenersAttached = false;

function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  // Dupa pornire, Mongoose recupereaza singur erorile tranzitorii.
  mongoose.connection.on("error", (error) => {
    console.error("[db] Eroare MongoDB:", error.message);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("[db] Deconectat de la MongoDB.");
  });
}

/** Log detaliat: ce spune FIECARE server din cluster (DNS vs TCP vs TLS vs auth). */
function logConnectError(error) {
  const servers = {};
  const descriptions = error?.reason?.servers ?? new Map();
  for (const [host, description] of descriptions) {
    if (description?.error) {
      servers[host] = String(description.error.message || "").slice(0, 200);
    }
  }
  console.error(
    "[db] Conectarea la MongoDB a esuat:",
    JSON.stringify({
      name: error?.name,
      message: String(error?.message || "").slice(0, 300),
      code: error?.code,
      codeName: error?.codeName,
      servers,
    })
  );
}

/**
 * Conecteaza (o singura data) si returneaza conexiunea.
 * Apeluri concurente primesc aceeasi promisiune.
 */
export function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose.connection);
  }
  if (connectPromise) return connectPromise;

  if (!env.mongoUri) {
    return Promise.reject(
      new Error("[db] MONGODB_URI lipseste. Creeaza server/.env pe baza .env.example")
    );
  }

  attachListeners();

  connectPromise = mongoose
    .connect(env.mongoUri, {
      maxPoolSize: env.mongoPoolSize, // connection pool reutilizat
      minPoolSize: 1,
      serverSelectionTimeoutMS: 8000, // pica repede daca Atlas nu raspunde
      socketTimeoutMS: 30000,
      family: 4, // IPv4, evita probleme de DNS IPv6 in unele hosturi
    })
    .then(() => {
      console.log("[db] Conectat la MongoDB.");
      return mongoose.connection;
    })
    .catch((error) => {
      connectPromise = null; // urmatoarea cerere reincearca
      logConnectError(error);
      throw error;
    });

  return connectPromise;
}

/** Middleware Express: garanteaza conexiunea inainte de rutele care o folosesc. */
export async function ensureDatabase(_req, res, next) {
  try {
    await connectDatabase();
    next();
  } catch {
    res
      .status(503)
      .json({ error: "Baza de date nu este disponibilă momentan. Reîncearcă în câteva secunde." });
  }
}

export function databaseState() {
  // 0 = deconectat, 1 = conectat, 2 = se conecteaza, 3 = se deconecteaza
  return ["disconnected", "connected", "connecting", "disconnecting"][
    mongoose.connection.readyState
  ] ?? "unknown";
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  connectPromise = null;
  console.log("[db] Conexiune MongoDB inchisa curat.");
}
