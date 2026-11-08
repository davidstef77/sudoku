/**
 * Middleware de autentificare JWT.
 * Optimizare: tokenul este verificat criptografic, FARA acces la baza de date
 * (payload-ul contine doar sub = userId). La nevoie, rutele pot incarca
 * documentul complet prin `requireUser`.
 */

import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

/** Verifica tokenul si ataseaza req.userId. 401 daca lipseste / e invalid. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Autentificare lipsă." });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Token invalid sau expirat." });
  }
}

/** Incarca si documentul utilizatorului (pentru rute care il au nevoie). */
export async function requireUser(req, res, next) {
  const user = await User.findById(req.userId).lean();
  if (!user) {
    return res.status(401).json({ error: "Utilizatorul nu există." });
  }
  req.user = user;
  next();
}
