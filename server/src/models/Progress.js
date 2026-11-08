/**
 * Progresul unui puzzle, pentru un utilizator.
 * Index compus unic (userId + puzzleId) — upsert-urile sunt O(1) si sigure.
 */

import mongoose from "mongoose";

const progressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 1..1000 — id-ul puzzle-ului din puzzles.json.
    puzzleId: { type: Number, required: true, min: 1 },

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard", "expert", "master", "extreme"],
      required: true,
    },

    // 81 de numere — valorile corecte plasate pana acum.
    values: { type: [Number], default: [] },
    // 81 de string-uri — notitele cu creion.
    notes: { type: [String], default: [] },

    elapsed: { type: Number, default: 0, min: 0 },
    mistakes: { type: Number, default: 0, min: 0 },
    hintsUsed: { type: Number, default: 0, min: 0 },
    correct: { type: Number, default: 0, min: 0 },
    completed: { type: Boolean, default: false },

    // Sursa adevarului pentru conflict resolution (last-write-wins).
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false }
);

// Unic per (utilizator, puzzle) — blocheaza dublurile la sincronizare concurenta.
progressSchema.index({ userId: 1, puzzleId: 1 }, { unique: true });

// Pentru ecrane de tip "puzzle-urile mele rezolvate recent".
progressSchema.index({ userId: 1, updatedAt: -1 });

progressSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret._id;
    return ret;
  },
});

export const Progress = mongoose.model("Progress", progressSchema);
export default Progress;
