/**
 * Configurare centralizata, citita o singura data din variabilele de mediu.
 * In dezvoltare exista valori implicite sigure; in productie toate variabilele
 * critice sunt OBLIGATORII, ca sa nu mearga in productie cu setari slabe.
 */

import "dotenv/config";

const isProd = process.env.NODE_ENV === "production";

/** Arunca eroare clara daca o variabila obligatorie lipseste. */
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[config] Variabila obligatorie ${name} lipseste. Verifica server/.env`
    );
  }
  return value;
}

/**
 * Parola default doar pentru dezvoltare, ca serverul sa porneasca usor.
 * In productie secretul JWT este obligatoriu si lung.
 */
const devJwtSecret = "dev-only-secret-schimba-in-productie-32+chars";

const jwtSecret = isProd
  ? required("JWT_SECRET")
  : process.env.JWT_SECRET || devJwtSecret;

if (isProd && jwtSecret.length < 32) {
  throw new Error("[config] JWT_SECRET trebuie sa aiba minim 32 de caractere.");
}

export const env = {
  isProd,

  port: Number(process.env.PORT || 4000),

  mongoUri: isProd ? required("MONGODB_URI") : process.env.MONGODB_URI || "",

  jwtSecret,
  jwtExpires: process.env.JWT_EXPIRES || "7d",

  // Origin-uri permise pentru CORS (lista separata prin virgula).
  corsOrigins: (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Numarul maxim de conexiuni MongoDB simultane (connection pool).
  mongoPoolSize: Number(process.env.MONGO_POOL_SIZE || 10),
};

export default env;
