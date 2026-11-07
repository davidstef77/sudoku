/**
 * Lista de puzzle-uri pentru un singur nivel de dificultate.
 * Acces simplu: butonul "Continuă" deschide primul puzzle nerezolvat,
 * iar mai jos se pot alege individual puzzle-urile, cu paginare.
 */

import { useMemo, useState } from "react";
import PuzzleCard from "./PuzzleCard.jsx";
import { DIFFICULTIES } from "../lib/sudoku.js";

const PAGE_SIZE = 60;

export default function LevelScreen({ level, puzzles, progress, onBack, onOpen }) {
  const [page, setPage] = useState(0);
  const meta = DIFFICULTIES[level];

  const items = useMemo(
    () => puzzles.filter((puzzle) => puzzle.difficulty === level),
    [puzzles, level]
  );

  const solvedCount = items.filter((puzzle) => progress[puzzle.id]?.completed).length;
  const startedCount = items.filter(
    (puzzle) => progress[puzzle.id] && !progress[puzzle.id].completed
  ).length;
  const first = items[0]?.id;
  const last = items[items.length - 1]?.id;

  const firstUnsolved = items.find((puzzle) => !progress[puzzle.id]?.completed);
  const continueId = firstUnsolved?.id ?? first;

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = items.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 pb-12 sm:px-6 sm:py-8">
      {/* ---------- bara de sus ---------- */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={onBack} className="btn-sm">
            ← Niveluri
          </button>

          <div className="flex items-center gap-2 text-sm text-muted">
            <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
            <span className={`font-bold ${meta.color}`}>{meta.label}</span>
            <span className="font-mono text-xs tabular-nums">
              #{first}–{last}
            </span>
          </div>
        </div>

        <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{meta.label}</h1>
            <p className="mt-0.5 text-xs text-muted">
              {items.length} puzzle-uri · {meta.givens} cifre inițiale ·{" "}
              {solvedCount} rezolvate · {startedCount} începute
            </p>
          </div>

          {continueId && (
            <button
              onClick={() => onOpen(continueId)}
              className="btn-primary shrink-0 text-xs"
            >
              {firstUnsolved ? `Continuă cu #${continueId}` : `Reia #${continueId}`}
            </button>
          )}
        </div>
      </header>

      {/* ---------- lista de puzzle-uri ---------- */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {slice.map((puzzle) => (
          <PuzzleCard
            key={puzzle.id}
            puzzle={puzzle}
            progress={progress[puzzle.id]}
            onOpen={onOpen}
          />
        ))}
      </div>

      {items.length === 0 && (
        <p className="py-16 text-center text-sm text-muted">
          Niciun puzzle pentru acest nivel.
        </p>
      )}

      {pageCount > 1 && <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />}
    </div>
  );
}

/** Navigarea intre pagini. */
function Pagination({ page, pageCount, onChange }) {
  return (
    <div className="flex items-center justify-center gap-2 pb-2">
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="btn-sm"
      >
        ← Înapoi
      </button>
      <span className="px-2 text-xs tabular-nums text-muted">
        {page + 1} / {pageCount}
      </span>
      <button
        onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
        disabled={page >= pageCount - 1}
        className="btn-sm"
      >
        Înainte →
      </button>
    </div>
  );
}
