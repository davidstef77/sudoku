/**
 * Conexiunea la MongoDB Atlas.
 * Mongoose mentine un connection pool intern; optimizarile sunt:
 *   - maxPoolSize limitat (atlas free tier are limita de conexiuni);
 *   - serverSelectionTimeout scurt, ca sa pici repede daca Atlas nu e disponibil;
 *   - fara retryMeteor in bucla infinita — conexiunea se face o singura data la pornire.
 */

import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectDatabase() {
  if (!env.mongoUri) {
    throw new Error(
      "[db] MONGODB_URI lipseste. Creeaza server/.env pe baza .env.example"
    );
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(env.mongoUri, {
    maxPoolSize: env.mongoPoolSize, // connection pool reutilizat
    minPoolSize: 2, // pastram cateva conexiuni calde
    serverSelectionTimeoutMS: 8000, // pica repede daca Atlas nu raspunde
    socketTimeoutMS: 30000,
    family: 4, // IPv4, evita probleme de DNS IPv6 in unele hosturi
  });

  // La productie nu vrem sa ascundem erorile, dar nici sa crape procesul
  // dupa pornire pentru erori tranzitorii — Mongoose recupereaza singur.
  mongoose.connection.on("error", (error) => {
    console.error("[db] Eroare MongoDB:", error.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[db] Deconectat de la MongoDB.");
  });

  console.log("[db] Conectat la MongoDB Atlas.");
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  console.log("[db] Conexiune MongoDB inchisa curat.");
}
