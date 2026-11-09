/**
 * Autentificare: inregistrare, logare, profil.
 * Optimizari:
 *   - rate limit strict pe rutele de autentificare (blocheaza brute-force);
 *   - bcrypt cu cost 10 (echilibru securitate/latenta);
 *   - parola NU este niciodata selectata fara nevoie (+select la login);
 *   - raspunsul de login nu atinge baza a doua oara (token direct din doc);
 *   - login cu email inexistent face tot un bcrypt.compare (timp constant —
 *     nu se poate afla prin cronometrare daca un email are cont).
 *
 * Rute:
 *   POST   /api/auth/register
 *   POST   /api/auth/login
 *   GET    /api/auth/me
 *   PATCH  /api/auth/me   { displayName }            — schimba numele afisat
 *   DELETE /api/auth/me   { password }               — sterge contul + toate datele
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Progress } from "../models/Progress.js";
import { XpEvent } from "../models/XpEvent.js";
import { requireAuth } from "../middleware/auth.js";
import { validateCredentials, sanitizeDisplayName, PASSWORD_MAX } from "../lib/validation.js";

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

/** Hash fals, comparat cand emailul nu exista (egalizeaza timpul de raspuns). */
const DUMMY_HASH = bcrypt.hashSync("parola-inexistenta-pentru-timing", 10);

router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const displayName = sanitizeDisplayName(req.body?.displayName);

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
    if (!email || !password || password.length > PASSWORD_MAX) {
      return res.status(401).json({ error: "Email sau parolă greșită." });
    }

    const user = await User.findOne({ email }).select("+passwordHash");

    // Comparam mereu (si cu hash fals) — mesaj si timp identice pentru
    // "email inexistent" si "parola gresita".
    const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
    if (!user || !ok) {
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
    // Fara lean(): toJSON transforma _id -> id, la fel ca la register/login
    // (inainte /me returna `_id`, iar register/login `id`).
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: "Utilizator inexistent." });
    res.json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/auth/me — actualizeaza numele afisat (singurul camp editabil). */
router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    if (typeof req.body?.displayName !== "string") {
      return res.status(400).json({ error: "Câmpul displayName este obligatoriu." });
    }
    const displayName = sanitizeDisplayName(req.body.displayName);

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { displayName } },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(401).json({ error: "Utilizator inexistent." });
    res.json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/auth/me — sterge definitiv contul si toate datele asociate
 * (progres, evenimente XP). Cere parola, ca un token furat sa nu ajunga.
 */
router.delete("/me", authLimiter, requireAuth, async (req, res, next) => {
  try {
    const password = String(req.body?.password || "");
    const user = await User.findById(req.userId).select("+passwordHash");
    if (!user) return res.status(401).json({ error: "Utilizator inexistent." });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(403).json({ error: "Parolă greșită." });

    await Promise.all([
      Progress.deleteMany({ userId: user._id }),
      XpEvent.deleteMany({ userId: user._id }),
    ]);
    await User.deleteOne({ _id: user._id });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
