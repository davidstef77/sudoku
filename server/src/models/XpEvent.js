/**
 * Evenimentul de XP: o inregistrare UNICA per (utilizator, puzzle).
 * Indexul unic impune la nivel de DB regula "acelasi puzzle nu poate
 * primi XP de doua ori", indiferent cate sync-uri trimite clientul.
 */

import mongoose from "mongoose";

const xpEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    puzzleId: { type: Number, required: true },
    difficulty: {
      type: String,
      required: true,
      enum: ["easy", "medium", "hard", "expert", "master", "extreme"],
    },
    amount: { type: Number, required: true, min: 0 },
    seconds: { type: Number, required: true, min: 0 },
    mistakes: { type: Number, default: 0, min: 0 },
    hintsUsed: { type: Number, default: 0, min: 0 },
    perfect: { type: Boolean, default: false },
    // Evenimente sintetice (realizari) — nu corespund unui puzzle real.
    synthetic: { type: Boolean, default: false },
    achievementId: { type: String, default: null },
    at: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

// Regula anti-dublu-recompensa: un singur eveniment per puzzle per utilizator.
xpEventSchema.index({ userId: 1, puzzleId: 1 }, { unique: true });

export const XpEvent = mongoose.model("XpEvent", xpEventSchema);
export default XpEvent;
