/**
 * Punct de intrare serverless pentru Vercel.
 *
 * Nu exista un "listen" pornit o singura data: conexiunea Mongoose e
 * initiata la cold start si garantata per-cerere de middleware-ul
 * `ensureDatabase` din app.js (cu reincercare daca prima conectare a esuat).
 */

import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/db/connect.js";

// Pornim conectarea devreme (in paralel cu prima cerere); eroarea e logata
// in connect.js, iar cererile urmatoare reincearca.
connectDatabase().catch(() => {});

const app = createApp();

export default app;
