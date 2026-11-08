/**
 * Pagina principala: selectarea nivelului + provocarea zilei + setari.
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
  daily,
  user,
  onOpenLevel,
  onContinue,
  onOpenTuring,
  onOpenDaily,
  onOpenSettings,
  onOpenAuth,
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
              Alege un nivel de dificultate. Progresul se salvează automat.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onOpenSettings} className="btn-sm" aria-label="Setări">
              ⚙️ Setări
            </button>
            <button
              onClick={onOpenAuth}
              className="btn-sm"
              aria-label={user ? "Contul meu" : "Autentificare"}
            >
              {user
                ? `👤 ${user.displayName || user.email?.split("@")[0]}`
                : "🔐 Cont"}
            </button>
            {lastPlayed && (
              <button onClick={onContinue} className="btn-primary">
                Continuă #{lastPlayed}
              </button>
            )}
          </div>
        </div>

        {/* ---------- statistici generale ---------- */}
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
            label="Seria zilnică"
            value={daily?.streak ? `🔥 ${daily.streak}` : "—"}
            tone="text-accentSoft"
          />
        </div>

        {/* ---------- recorduri personale (#5) ---------- */}
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
                  className="flex flex-col gap-1 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"
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
      </header>

      {/* ---------- provocarea zilei (#4) ---------- */}
      {daily?.puzzle && (
        <button
          onClick={onOpenDaily}
          className="group flex items-center justify-between gap-4 rounded-2xl border border-white/15 bg-gradient-to-r from-accent/10 via-panel/90 to-panel/90 p-4 text-left transition hover:border-white/40"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/5 text-lg">
              🗓️
            </span>
            <div>
              <p className="font-mono text-sm font-bold text-white">
                Provocarea zilei · {daily.puzzle.difficultyLabel}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {daily.solvedToday
                  ? "✅ Rezolvată azi — seria continuă mâine"
                  : `Puzzle #${daily.puzzle.id} · seria: ${daily.streak || 0} 🔥`}
              </p>
            </div>
          </div>
          <span className="btn-sm shrink-0 font-mono">
            {daily.solvedToday ? "Vezi →" : "Joacă →"}
          </span>
        </button>
      )}

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
