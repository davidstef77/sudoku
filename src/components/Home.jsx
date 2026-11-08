/**
 * Pagina principala: dashboard-ul jucatorului.
 * Statistici, nivel/XP, recorduri, provocarea zilei, joc bonus si cele 6
 * niveluri de dificultate — cu aspect premium (accents violet, iconite
 * Lucide, animatii subtile).
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Grid3x3,
  Play,
  Timer,
  Flame,
  Zap,
  CalendarDays,
  Bot,
  ChevronRight,
  Target,
} from "lucide-react";
import { DIFFICULTIES, DIFFICULTY_ORDER, formatTime } from "../lib/sudoku.js";
import { levelProgress, rankForLevel, XP_PER_DIFFICULTY } from "../lib/xp.js";

export default function Home({
  puzzles,
  progress,
  stats,
  lastPlayed,
  daily,
  profile,
  onOpenLevel,
  onContinue,
  onOpenTuring,
  onOpenDaily,
  onReset,
}) {
  // Informatii agregate pentru fiecare nivel.
  const levels = useMemo(
    () =>
      DIFFICULTY_ORDER.map((key) => {
        const meta = DIFFICULTIES[key];
        const items = puzzles.filter((puzzle) => puzzle.difficulty === key);
        const solved = items.filter((puzzle) => progress[puzzle.id]?.completed).length;
        const started = items.filter(
          (puzzle) => progress[puzzle.id] && !progress[puzzle.id].completed
        ).length;
        const first = items[0]?.id;
        const last = items[items.length - 1]?.id;

        return { key, meta, total: items.length, solved, started, first, last };
      }),
    [puzzles, progress]
  );

  const solvedCount = useMemo(
    () => Object.values(progress).filter((entry) => entry.completed).length,
    [progress]
  );
  const startedCount = Math.max(0, Object.keys(progress).length - solvedCount);

  const level = levelProgress(profile?.xp || 0);
  const unlockedCount = Object.keys(profile?.unlocked || {}).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 py-6 pb-12 sm:px-6 sm:py-8">
      {/* ---------- ero + nivel ---------- */}
      <section className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
        <div className="flex-1">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-accent">
            <Zap size={13} /> Dashboard jucător
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Sudoku <span className="text-gradient">1000</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
            Alege un nivel de dificultate. Progresul se salvează automat, iar
            fiecare puzzle rezolvat îți aduce XP.
          </p>

          {lastPlayed && (
            <button onClick={onContinue} className="btn-primary mt-4 inline-flex items-center gap-2">
              <Play size={15} />
              Continuă puzzle-ul #{lastPlayed}
            </button>
          )}
        </div>

        {/* cardul de nivel / XP */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="card relative w-full overflow-hidden p-4 lg:max-w-xs"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/20 blur-3xl" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
                Nivel {level.level} · {rankForLevel(level.level)}
              </p>
              <p className="font-mono text-2xl font-bold tabular-nums text-accent">
                {level.xp.toLocaleString("ro-RO")} XP
              </p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 font-heading text-lg font-bold text-accent ring-1 ring-inset ring-accent/40">
              {level.level}
            </span>
          </div>
          <div className="progress-bar mt-3">
            <div className="progress-fill" style={{ width: `${level.percent}%` }} />
          </div>
          <p className="mt-1.5 text-[0.65rem] text-muted">
            {level.xpForNext - level.xpInLevel} XP până la nivelul {level.level + 1} ·{" "}
            {unlockedCount} realizări
          </p>
        </motion.div>
      </section>

      {/* ---------- statistici generale ---------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Grid3x3 size={15} />} label="Rezolvate" value={`${solvedCount} / ${puzzles.length}`} />
        <Stat icon={<Play size={15} />} label="Începute" value={String(startedCount)} tone="text-accent" />
        <Stat icon={<Timer size={15} />} label="Timp total" value={formatTime(stats.totalSeconds)} />
        <Stat
          icon={<Flame size={15} />}
          label="Seria zilnică"
          value={daily?.streak ? `${daily.streak}` : "—"}
          tone="text-warn"
        />
      </div>

      {/* ---------- recorduri personale ---------- */}
      <section className="card p-4">
        <h2 className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
          Recorduri personale — cel mai rapid timp per nivel
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {DIFFICULTY_ORDER.map((key) => {
            const meta = DIFFICULTIES[key];
            const best = stats.bestTimes?.[key];
            return (
              <div
                key={key}
                className="flex flex-col gap-1 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 transition hover:border-accent/30"
              >
                <span className="flex items-center gap-1.5 text-[0.65rem] font-semibold">
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  <span className={meta.color}>{meta.label}</span>
                </span>
                <span
                  className={`font-mono text-sm font-bold tabular-nums ${
                    best ? "text-white" : "text-muted/50"
                  }`}
                >
                  {best ? formatTime(best) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- provocarea zilei ---------- */}
      {daily?.puzzle && (
        <button
          onClick={onOpenDaily}
          className="card card-hover group flex items-center justify-between gap-4 p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-warn/30 bg-warn/10 text-warn">
              <CalendarDays size={19} />
            </span>
            <div>
              <p className="flex items-center gap-2 font-semibold">
                Provocarea zilei
                <span className={`badge ${DIFFICULTIES[daily.difficulty]?.color ?? ""}`}>
                  {daily.difficultyLabel}
                </span>
                {daily.streak > 0 && (
                  <span className="badge text-warn">🔥 {daily.streak} zile</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {daily.solvedToday
                  ? "Rezolvată azi — seria continuă mâine"
                  : `Puzzle #${daily.puzzle.id} · ${XP_PER_DIFFICULTY[daily.difficulty]} XP`}
              </p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent">
            {daily.solvedToday ? "Vezi" : "Joacă"}
            <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>
      )}

      {/* ---------- joc bonus: Turing Test ---------- */}
      <button
        onClick={onOpenTuring}
        className="card card-hover group flex items-center justify-between gap-4 p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
            <Bot size={19} />
          </span>
          <div>
            <p className="font-semibold">Turing Test pentru Roboți</p>
            <p className="mt-0.5 text-xs text-muted">
              Ghicește codul de 4 culori în 10 încercări. Robotul răspunde vag.
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent">
          Joacă
          <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>

      {/* ---------- nivelurile ---------- */}
      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-muted">
          <Target size={14} /> Alege nivelul
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {levels.map(({ key, meta, total, solved, started, first, last }, index) => {
            const percent = total ? Math.round((solved / total) * 100) : 0;
            return (
              <motion.button
                key={key}
                type="button"
                onClick={() => onOpenLevel(key)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.25 }}
                className="card card-hover group flex flex-col gap-3 p-4 text-left"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`h-3 w-3 rounded-full ${meta.dot} shadow-glow`} />
                  <h3 className="text-lg font-bold">{meta.label}</h3>
                  <span className="ml-auto font-mono text-xs tabular-nums text-muted">
                    #{first}–{last}
                  </span>
                </div>

                <p className="text-xs text-muted">
                  {meta.givens} cifre inițiale · {total} puzzle-uri ·{" "}
                  <span className="font-semibold text-accent">
                    +{XP_PER_DIFFICULTY[key]} XP
                  </span>
                </p>

                <div className="flex items-center gap-2 text-xs text-muted">
                  <div className="progress-bar flex-1">
                    <div className="progress-fill" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="shrink-0 tabular-nums">
                    {solved}/{total}
                  </span>
                </div>

                {started > 0 && (
                  <p className="text-[0.65rem] text-accentSoft">
                    {started} începute · continuă de unde ai rămas
                  </p>
                )}

                <span className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-accent/10 py-2.5 text-xs font-bold text-accent ring-1 ring-inset ring-accent/30 transition group-hover:bg-accent/20">
                  Joacă nivelul
                  <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      <footer className="mt-auto pt-4 text-center text-[0.7rem] text-muted/70">
        {DIFFICULTY_ORDER.map((key, index) => (
          <span key={key}>
            {index > 0 && " · "}
            {DIFFICULTIES[key].label}
          </span>
        ))}{" "}
        — toate puzzle-urile au o singură soluție.
      </footer>
    </div>
  );
}

function Stat({ icon, label, value, tone = "text-white" }) {
  return (
    <div className="card card-hover px-4 py-3">
      <p className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider text-muted">
        <span className="text-accent">{icon}</span>
        {label}
      </p>
      <p className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
