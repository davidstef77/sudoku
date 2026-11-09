/**
 * Aplicatia Express — middleware si rute.
 * Optimizari de securitate si performanta:
 *   - helmet (headers de securitate);
 *   - compression (gzip — important pentru payload-uri de progres);
 *   - CORS cu allowlist (nu *);
 *   - rate limit global, moderat;
 *   - body JSON limitat la 256kb (nu avem nevoie de mai mult);
 *   - trust proxy (pentru deploy in spatele unui reverse proxy / Vercel).
 */

import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import progressRoutes from "./routes/progress.routes.js";
import metaRoutes from "./routes/meta.routes.js";
import { notFound, errorHandler, HttpError } from "./middleware/errors.js";
import { ensureDatabase, databaseState } from "./db/connect.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // IP real din spatele proxy-ului

  // ---------- securitate ----------
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "same-origin" },
    })
  );

  // CORS cu allowlist; daca lista e goala (dev), permitem localhost:5173.
  const allowedOrigins =
    env.corsOrigins.length > 0
      ? env.corsOrigins
      : ["http://localhost:5173", "http://127.0.0.1:5173"];

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        callback(new HttpError(403, "Origine CORS nepermisă."));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400, // cache preflight 24h — mai putine OPTIONS
    })
  );

  // ---------- performanta ----------
  app.use(compression());
  app.use(express.json({ limit: "256kb" }));

  if (!env.isProd) {
    app.use(morgan("dev"));
  }

  // Rate limit global generos, doar ca siguranta de baza.
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300, // 300 cereri / 15 min / IP
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Prea multe cereri. Încercați mai târziu." },
    })
  );

  // ---------- rute ----------
  // Health check: nu atinge baza, dar raporteaza starea conexiunii.
  app.get("/api/health", (_req, res) => {
    const db = databaseState();
    res.status(db === "connected" ? 200 : 503).json({
      ok: db === "connected",
      db,
      uptime: process.uptime(),
    });
  });

  // Toate rutele de mai jos au nevoie de MongoDB: 503 rapid daca nu e disponibil.
  app.use("/api", ensureDatabase);

  app.use("/api/auth", authRoutes);
  app.use("/api/progress", progressRoutes);
  app.use("/api", metaRoutes); // /api/achievements, /api/leaderboard

  // ---------- erori ----------
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
