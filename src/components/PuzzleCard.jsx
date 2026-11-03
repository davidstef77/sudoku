/**
 * Cardul unui puzzle in lista. Arata numarul, dificultatea si progresul salvat.
 */

import { DIFFICULTIES } from "../lib/sudoku.js";

export default function PuzzleCard({ puzzle, progress, onOpen }) {
  const meta = DIFFICULTIES[puzzle.difficulty];
  const solved = progress?.completed;
  const started = progress && !progress.completed;

  // Procentul de celule completate corect.
  const percent = progress
    ? Math.round(((progress.correct ?? puzzle.givens) / 81) * 100)
    : Math.round((puzzle.givens / 81) * 100);

  return (
    <button
      type="button"
      onClick={() => onOpen(puzzle.id)}
      className={`group relative flex flex-col gap-2 rounded-xl border p-3 text-left transition
        hover:-translate-y-0.5 hover:shadow-card active:translate-y-0
        ${
          solved
            ? "border-good/40 bg-good/[0.08] hover:border-good/60"
            : started
            ? "border-accent/30 bg-accent/[0.07] hover:border-accent/60"
            : "border-white/10 bg-panel/80 hover:border-white/20"
        }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-bold tabular-nums text-slate-100">
          #{puzzle.id}
        </span>
        {solved && <span className="text-base leading-none text-good">✓</span>}
      </div>

      <div className="flex items-center justify-between text-[0.65rem] text-muted">
        <span className={`flex items-center gap-1.5 font-semibold ${meta.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        <span className="tabular-nums">{puzzle.givens} date</span>
      </div>

      {/* Bara de progres */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            solved ? "bg-good" : started ? "bg-accent" : "bg-white/15"
          }`}
          style={{ width: `${solved ? 100 : started ? percent : 0}%` }}
        />
      </div>
    </button>
  );
}
