/**
 * Notificarile animate pentru realizarile deblocate + cresterea in nivel.
 * Stiva fixa in coltul dreapta-sus; fiecare toast se auto-închide.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, ArrowUpCircle } from "lucide-react";
import { ACHIEVEMENT_BY_ID, RARITIES } from "../lib/achievements.js";

const TOAST_MS = 5000;

/** Coada de notificari: [{ type: "achievement", id } | { type: "level", level }] */
export default function AchievementToasts({ toasts, onDismiss }) {
  useEffect(() => {
    if (toasts.length === 0) return undefined;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => onDismiss(toast.key), TOAST_MS)
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts, onDismiss]);

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-[60] flex w-72 flex-col gap-2 sm:right-6">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.key}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="pointer-events-auto"
            onClick={() => onDismiss(toast.key)}
          >
            {toast.type === "level" ? (
              <LevelToast level={toast.level} />
            ) : (
              <AchievementToastContent id={toast.id} />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function AchievementToastContent({ id }) {
  const achievement = ACHIEVEMENT_BY_ID[id];
  if (!achievement) return null;
  const rarity = RARITIES[achievement.rarity];

  return (
    <div className="card flex items-center gap-3 border-accent/40 p-3 shadow-glow">
      <motion.span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-2xl"
        animate={{ rotate: [0, -8, 8, 0] }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {achievement.icon}
      </motion.span>
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-accent">
          <Trophy size={10} /> Realizare {rarity.label.toLowerCase()}
        </p>
        <p className="truncate text-sm font-bold">{achievement.name}</p>
        <p className="text-[0.65rem] text-muted">+{achievement.xpReward} XP</p>
      </div>
    </div>
  );
}

function LevelToast({ level }) {
  return (
    <div className="card flex items-center gap-3 border-warn/50 p-3 shadow-glow">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warn/15 text-warn">
        <ArrowUpCircle size={22} />
      </span>
      <div>
        <p className="text-[0.6rem] font-bold uppercase tracking-wider text-warn">
          Nivel nou
        </p>
        <p className="text-sm font-bold">Nivel {level} atins!</p>
      </div>
    </div>
  );
}
