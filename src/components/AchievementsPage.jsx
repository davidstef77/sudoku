/**
 * Pagina de realizari (achievements).
 * offline: definitii + evaluare locala; autentificat: date autoritare de la
 * server (aceleasi definitii, evaluate pe datele serverului).
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Lock, Check } from "lucide-react";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  RARITIES,
  achievementProgress,
} from "../lib/achievements.js";
import api from "../lib/api.js";

const CATEGORY_ORDER = ["progress", "difficulty", "speed", "consistency", "perfection"];

export default function AchievementsPage({ profile, localContext, user, onBack, onSynced }) {
  const [serverData, setServerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("all");

  const authenticated = Boolean(user);

  // La autentificare, realizarile vin de la server (sursa autoritara).
  useEffect(() => {
    if (!authenticated) {
      setServerData(null);
      return undefined;
    }

    let active = true;
    setLoading(true);
    api
      .fetchAchievements()
      .then((data) => {
        if (active) {
          setServerData(data);
          onSynced?.(data);
        }
      })
      .catch(() => {
        // Server indisponibil — cadem pe datele locale.
        if (active) setServerData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  const unlockedIds = useMemo(() => {
    if (serverData) return new Set(serverData.achievements.filter((a) => a.unlocked).map((a) => a.id));
    return new Set(Object.keys(profile?.unlocked || {}));
  }, [serverData, profile]);

  const items = useMemo(
    () =>
      ACHIEVEMENTS.map((definition) => {
        const context = serverData ? fakeContextFromServer(serverData) : localContext;
        const [current, target] = achievementProgress(definition, context || {});
        return {
          ...definition,
          current,
          target,
          unlocked: unlockedIds.has(definition.id),
        };
      }),
    [serverData, localContext, unlockedIds]
  );

  const visible = items.filter(
    (item) => category === "all" || item.category === category
  );
  const unlockedCount = items.filter((item) => item.unlocked).length;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-12 pt-6 sm:px-6 sm:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 ring-1 ring-inset ring-accent/40">
              <Trophy className="text-accent" size={20} />
            </span>
            Realizări
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {unlockedCount} din {items.length} deblocate · fiecare adaugă XP bonus.
          </p>
        </div>
        <div className="progress-bar w-48">
          <div
            className="progress-fill"
            style={{ width: `${items.length ? Math.round((unlockedCount / items.length) * 100) : 0}%` }}
          />
        </div>
      </header>

      {/* filtre pe categorie */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="Toate"
          active={category === "all"}
          onClick={() => setCategory("all")}
        />
        {CATEGORY_ORDER.map((key) => (
          <FilterChip
            key={key}
            label={ACHIEVEMENT_CATEGORIES[key]}
            active={category === key}
            onClick={() => setCategory(key)}
          />
        ))}
      </div>

      {loading && <p className="text-sm text-muted">Se încarcă realizările…</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item, index) => (
          <AchievementCard key={item.id} item={item} index={index} />
        ))}
      </div>
    </div>
  );
}

/** Context minimal reconstruit din raspunsul serverului, pentru progres. */
function fakeContextFromServer(serverData) {
  const context = serverData.context || {};
  return {
    solved: context.solved ?? 0,
    solvedByDifficulty: context.solvedByDifficulty ?? {},
    bestTimes: context.bestTimes ?? {},
    streak: context.streak ?? 0,
    perfectSolves: context.perfectSolves ?? 0,
  };
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`chip ${active ? "chip-active" : "chip-idle"}`}
    >
      {label}
    </button>
  );
}

function AchievementCard({ item, index }) {
  const rarity = RARITIES[item.rarity];
  const percent = item.target ? Math.round((item.current / item.target) * 100) : 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4), duration: 0.25 }}
      className={`card card-hover relative flex flex-col gap-3 overflow-hidden p-4 ${
        item.unlocked ? `ring-1 ${rarity.ring}` : ""
      }`}
    >
      {item.unlocked && (
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-good/15 text-good">
          <Check size={14} strokeWidth={3} />
        </span>
      )}

      <div className="flex items-start gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${
            item.unlocked ? "bg-accent/15" : "bg-white/[0.04] grayscale opacity-50"
          }`}
        >
          {item.icon}
        </span>
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-bold leading-tight">
            {item.name}
            {!item.unlocked && <Lock size={12} className="text-muted/60" />}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[0.6rem]">
        <span className={`badge ${rarity.color}`}>{rarity.label}</span>
        <span className="badge text-accent">+{item.xpReward} XP</span>
        <span className="ml-auto text-muted">{ACHIEVEMENT_CATEGORIES[item.category]}</span>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-[0.65rem] text-muted">
          <span>progres</span>
          <span className="tabular-nums">
            {item.unlocked ? "deblocată" : `${item.current} / ${item.target}`}
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${item.unlocked ? 100 : percent}%` }}
          />
        </div>
      </div>
    </motion.article>
  );
}
