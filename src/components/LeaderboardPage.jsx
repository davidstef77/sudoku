/**
 * Clasamentul (leaderboard).
 * Scopuri: global / saptamanal / lunar; sortare: XP, puzzle-uri, serie,
 * sau XP pe o dificultate data. Podiu special pentru primii 3.
 * Datele vin exclusiv de la server (necesita cont).
 */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Medal, Crown, Flame, Puzzle, Coins, User as UserIcon } from "lucide-react";
import api from "../lib/api.js";
import { DIFFICULTIES, DIFFICULTY_ORDER } from "../lib/sudoku.js";

const SCOPES = [
  { key: "global", label: "Global" },
  { key: "weekly", label: "Săptămânal" },
  { key: "monthly", label: "Lunar" },
];

const METRICS = [
  { key: "xp", label: "XP", icon: Coins },
  { key: "solved", label: "Rezolvate", icon: Puzzle },
  { key: "streak", label: "Serie", icon: Flame },
];

export default function LeaderboardPage({ user, onOpenAuth }) {
  const [scope, setScope] = useState("global");
  const [sort, setSort] = useState("xp");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.fetchLeaderboard({ scope, sort });
      setData(result);
    } catch (loadError) {
      setError(loadError.message || "Nu am putut încărca clasamentul.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [scope, sort, user]);

  useEffect(() => {
    load();
  }, [load]);

  const entries = data?.entries || [];
  const myId = String(user?.id || "");
  const marked = entries.map((entry) => ({ ...entry, isMe: String(entry.userId) === myId }));
  const podium = marked.slice(0, 3);
  const rest = marked.slice(3);

  // ---------- fara cont ----------
  if (!user) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 ring-1 ring-inset ring-accent/40">
          <Medal className="text-accent" size={28} />
        </span>
        <h1 className="text-2xl font-bold">Clasament</h1>
        <p className="max-w-sm text-sm text-muted">
          Autentifică-te ca să apari în clasament și să compari XP-ul, puzzle-urile
          rezolvate și seria zilnică cu ceilalți jucători.
        </p>
        <button onClick={onOpenAuth} className="btn-primary mt-2">
          Autentificare
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 pb-12 pt-6 sm:px-6 sm:pt-8">
      <header>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 ring-1 ring-inset ring-accent/40">
            <Medal className="text-accent" size={20} />
          </span>
          Clasament
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Poziția ta este calculată pe server, din puzzle-uri verificate.
        </p>
      </header>

      {/* filtre */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {SCOPES.map((item) => (
            <button
              key={item.key}
              onClick={() => setScope(item.key)}
              className={`chip ${scope === item.key ? "chip-active" : "chip-idle"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {METRICS.map((item) => (
            <button
              key={item.key}
              onClick={() => setSort(item.key)}
              className={`chip ${sort === item.key ? "chip-active" : "chip-idle"}`}
            >
              <item.icon size={12} className="mr-1 inline" />
              {item.label}
            </button>
          ))}
          {DIFFICULTY_ORDER.map((key) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`chip ${sort === key ? "chip-active" : "chip-idle"}`}
            >
              <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${DIFFICULTIES[key].dot}`} />
              {DIFFICULTIES[key].label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-muted">Se încarcă clasamentul…</p>}
      {error && (
        <p className="card p-4 text-sm text-rose">
          {error} — încearcă din nou mai târziu.
        </p>
      )}

      {/* podium */}
      {!loading && !error && podium.length > 0 && (
        <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
          {podium.map((entry, index) => (
            <PodiumCard key={entry.userId} entry={entry} place={index} />
          ))}
        </div>
      )}

      {/* restul listei */}
      {!loading && !error && (
        <div className="flex flex-col gap-2">
          {rest.map((entry, index) => (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(index * 0.02, 0.3) }}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                entry.isMe
                  ? "border-accent/50 bg-accent/10"
                  : "border-white/5 bg-panel/70"
              }`}
            >
              <span className="w-7 text-center font-mono text-sm font-bold tabular-nums text-muted">
                {entry.rank}
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-xs font-bold">
                {initials(entry.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{entry.name}</p>
                <p className="text-[0.65rem] text-muted">
                  Nivel {entry.level} · {entry.solved} rezolvate · 🔥 {entry.streak}
                </p>
              </div>
              <span className="font-mono text-sm font-bold tabular-nums text-accent">
                {formatValue(entry)}
              </span>
            </motion.div>
          ))}

          {!loading && !error && entries.length === 0 && (
            <p className="py-12 text-center text-sm text-muted">
              Clasamentul e gol pentru această perioadă.
            </p>
          )}
        </div>
      )}

      {/* pozitia mea */}
      {!loading && !error && data?.me && !marked.some((entry) => entry.isMe) && data.me.rank && (
        <div className="flex items-center gap-3 rounded-xl border border-accent/50 bg-accent/10 px-3 py-2.5">
          <span className="w-7 text-center font-mono text-sm font-bold tabular-nums text-accent">
            {data.me.rank}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20">
            <UserIcon size={14} className="text-accent" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{data.me.name} (tu)</p>
            <p className="text-[0.65rem] text-muted">
              Nivel {data.me.level} · {data.me.solved} rezolvate · 🔥 {data.me.streak}
            </p>
          </div>
          <span className="font-mono text-sm font-bold tabular-nums text-accent">
            {formatValue(data.me)}
          </span>
        </div>
      )}
    </div>
  );
}

function formatValue(entry) {
  if (entry.metric === "solved") return `${entry.value} 🧩`;
  if (entry.metric === "streak") return `${entry.value} 🔥`;
  if (typeof entry.metric === "string" && entry.metric.startsWith("xp-")) {
    const difficulty = entry.metric.slice(3);
    return `${entry.value} XP (${DIFFICULTIES[difficulty]?.label ?? difficulty})`;
  }
  return `${entry.value} XP`;
}

function initials(name) {
  return String(name || "?")
    .trim()
    .slice(0, 2)
    .toUpperCase();
}

/** Podium: locurile 1-3, cu inaltimi diferite si accente de aur/argint/bronz. */
function PodiumCard({ entry, place }) {
  const styles = [
    {
      height: "sm:pb-8",
      ring: "ring-warn/60",
      glow: "from-warn/25",
      badge: "🥇",
      bar: "h-24 sm:h-28",
    },
    {
      height: "sm:pb-5",
      ring: "ring-white/40",
      glow: "from-white/15",
      badge: "🥈",
      bar: "h-16 sm:h-20",
    },
    {
      height: "sm:pb-3",
      ring: "ring-warn/30",
      glow: "from-warn/10",
      badge: "🥉",
      bar: "h-12 sm:h-14",
    },
  ][place];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: place * 0.08, duration: 0.3 }}
      className={`card card-hover flex flex-col items-center gap-1.5 p-3 text-center ring-1 ${styles.ring}`}
    >
      <span className="text-2xl">{styles.badge}</span>
      {place === 0 && <Crown size={14} className="text-warn" />}
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-sm font-bold">
        {initials(entry.name)}
      </span>
      <p className="max-w-full truncate text-xs font-bold">{entry.name}</p>
      <p className="text-[0.6rem] text-muted">Nivel {entry.level}</p>
      <span className="font-mono text-xs font-bold tabular-nums text-accent">
        {formatValue(entry)}
      </span>
      <div
        className={`w-full rounded-t-lg bg-gradient-to-t ${styles.glow} to-transparent ${styles.bar}`}
      />
    </motion.div>
  );
}
