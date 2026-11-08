/**
 * Autentificare: inregistrare, logare, profil.
 * Optimizari:
 *   - rate limit strict pe rutele de autentificare (blocheaza brute-force);
 *   - bcrypt cu cost 10 (echilibru securitate/latenta);
 *   - parola NU este niciodata selectata fara nevoie (+select la login);
 *   - raspunsul de login nu atinge baza a doua oara (token direct din doc).
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/** Limita stransa pentru inregistrare / logare. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20, // 20 incercari / 15 min / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Prea multe încercări. Mai încearcă în 15 minute." },
});

/** Emit un JWT minimal (sub = userId). */
function signToken(userId) {
  return jwt.sign({ sub: userId }, env.jwtSecret, {
    expiresIn: env.jwtExpires,
  });
}

function validateCredentials(email, password) {
  if (!email || typeof email !== "string") return "Emailul este obligatoriu.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Email invalid.";
  if (!password || password.length < 6)
    return "Parola trebuie să aibă minim 6 caractere.";
  return null;
}

router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const displayName = String(req.body?.displayName || "").trim().slice(0, 40);

    const invalid = validateCredentials(email, password);
    if (invalid) return res.status(400).json({ error: invalid });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({ email, passwordHash, displayName });

    res.status(201).json({
      token: signToken(user._id.toString()),
      user: user.toJSON(),
    });
  } catch (error) {
    // E11000 = email duplicat.
    if (error.code === 11000) {
      return res.status(409).json({ error: "Emailul este deja folosit." });
    }
    next(error);
  }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    // +select: parola hash este nevoie doar aici.
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) {
      // Mesaj generic — nu dam de înțeles dacă emailul exista.
      return res.status(401).json({ error: "Email sau parolă greșită." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Email sau parolă greșită." });
    }

    res.json({
      token: signToken(user._id.toString()),
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(401).json({ error: "Utilizator inexistent." });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
