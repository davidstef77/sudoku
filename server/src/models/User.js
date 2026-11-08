/**
 * Modelul de utilizator. Statisticsile globale sunt embedded in document,
 * ca sa le citim intr-o singura interogare, fara JOIN / a doua colectie.
 */

import mongoose from "mongoose";

const statsSchema = new mongoose.Schema(
  {
    solved: { type: Number, default: 0, min: 0 },
    attempted: { type: Number, default: 0, min: 0 },
    totalSeconds: { type: Number, default: 0, min: 0 },
    // { easy: 240, medium: 512, ... } — timpul cel mai bun per nivel.
    bestTimes: { type: Map, of: Number, default: {} },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // Email normalizat lowercase — index unic, cautarile sunt O(log n).
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email invalid"],
    },

    // Hash bcrypt; NICIODATA selectat implicit in interogari.
    passwordHash: { type: String, required: true, select: false },

    displayName: { type: String, trim: true, maxlength: 40, default: "" },

    stats: { type: statsSchema, default: () => ({}) },

    // Streak-ul provocarii zilei: ultima zi rezolvata (YYYY-MM-DD) si seria.
    daily: {
      lastCompleted: { type: String, default: null },
      streak: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true, // createdAt / updatedAt automate
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

userSchema.index({ createdAt: -1 }); // pentru statistici admin ulterioare

export const User = mongoose.model("User", userSchema);
export default User;
