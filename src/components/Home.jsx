/**
 * Pagina principiala: selectarea nivelului.
 * Fiecare nivel este un card mare si clar; un singur click deschide
 * lista de puzzle-uri a nivelului respectiv.
 */

import { useMemo } from "react";
import { DIFFICULTIES, DIFFICULTY_ORDER, formatTime } from "../lib/sudoku.js";

export default function Home({
  puzzles,
  progress,
  stats,
  lastPlayed,
  onOpenLevel,
  onContinue,
  onOpenTuring,
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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-7 px-4 py-6 pb-12 sm:px-6 sm:py-8">
      {/* ---------- antet ---------- */}
      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Sudoku <span className="text-gradient">1000</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
              Alege un nivel de dificultate. Progresul se salvează automat în browser.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {lastPlayed && (
              <button onClick={onContinue} className="btn-primary">
                Continua #{lastPlayed}
              </button>
            )}
            <button onClick={onReset} className="btn-ghost">
              Resetează progresul
            </button>
          </div>
        </div>

        {/* ---------- statistici ---------- */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Rezolvate"
            value={`${solvedCount} / ${puzzles.length}`}
            tone="text-white"
          />
          <Stat label="Începute" value={String(startedCount)} tone="text-accentSoft" />
          <Stat
            label="Timp total"
            value={formatTime(stats.totalSeconds)}
            tone="text-white"
          />
          <Stat
            label="Record ușor"
            value={stats.bestTimes?.easy ? formatTime(stats.bestTimes.easy) : "—"}
            tone="text-accentSoft"
          />
        </div>
      </header>

      {/* ---------- joc bonus: Turing Test ---------- */}
      <button
        onClick={onOpenTuring}
        className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-panel/80 p-4 text-left transition hover:border-white/30 hover:bg-panel"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/5 font-mono text-sm font-bold text-white">
            TT
          </span>
          <div>
            <p className="font-mono text-sm font-bold text-white">
              Turing Test pentru Roboți
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Ghiceste codul de 4 culori in 10 incercari. Robotul raspunde vag.
            </p>
          </div>
        </div>
        <span className="btn-sm shrink-0 font-mono">Joacă →</span>
      </button>

      {/* ---------- nivelurile ---------- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Alege nivelul
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {levels.map(({ key, meta, total, solved, started, first, last }) => (
            <button
              key={key}
              type="button"
              onClick={() => onOpenLevel(key)}
              className="card group flex flex-col gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-white/30 active:translate-y-0"
            >
              <div className="flex items-center gap-2.5">
                <span className={`h-3 w-3 rounded-full ${meta.dot}`} />
                <h3 className="text-lg font-bold text-white">{meta.label}</h3>
                <span className="ml-auto font-mono text-xs tabular-nums text-muted">
                  #{first}–{last}
                </span>
              </div>

              <p className="text-xs text-muted">
                {meta.givens} cifre inițiale · {total} puzzle-uri
              </p>

              <div className="flex items-center gap-2 text-xs text-muted">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-white/70 transition-all duration-300"
                    style={{ width: `${total ? Math.round((solved / total) * 100) : 0}%` }}
                  />
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

              <span className="btn-primary mt-1 text-center text-xs">Joacă nivelul →</span>
            </button>
          ))}
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

function Stat({ label, value, tone }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[0.65rem] uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
