/**
 * Ecranul de joc: incarca progresul din AsyncStorage, afiseaza tabla
 * si salveaza automat (debounce) dupa fiecare mutare.
 * Layout responsive: pe telefon tabla e sus, tastatura dedesubt;
 * pe desktop sunt una langa alta.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Board from "./Board.jsx";
import NumberPad from "./NumberPad.jsx";
import { DIFFICULTIES, formatTime } from "../lib/sudoku.js";
import { XP_PER_DIFFICULTY } from "../lib/xp.js";
import { useSudoku } from "../hooks/useSudoku.js";
import { loadProgress, saveProgress } from "../storage/progress.js";

const SAVE_DELAY = 350;

export default function GameScreen({ puzzle, onExit, onSolved, mistakesLimit = 5, isDaily = false }) {
  const [saved, setSaved] = useState(undefined); // undefined = se incarca

  // Incarcam progresul o singura data, la deschidere.
  useEffect(() => {
    let active = true;
    loadProgress(puzzle.id).then((data) => {
      if (active) setSaved(data);
    });
    return () => {
      active = false;
    };
  }, [puzzle.id]);

  if (saved === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Se incarca puzzle-ul #{puzzle.id}...
      </div>
    );
  }

  return (
    <Game
      puzzle={puzzle}
      saved={saved}
      onExit={onExit}
      onSolved={onSolved}
      mistakesLimit={mistakesLimit}
      isDaily={isDaily}
    />
  );
}

function Game({ puzzle, saved, onExit, onSolved, mistakesLimit, isDaily }) {
  const game = useSudoku(puzzle, saved, { mistakesLimit });
  const timer = useRef(null);
  const wasCompleted = useRef(Boolean(saved?.completed));

  const meta = DIFFICULTIES[puzzle.difficulty];

  /** Salvare automata cu debounce, ca sa nu scriem la fiecare tasta. */
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);

    timer.current = window.setTimeout(() => {
      saveProgress(puzzle.id, {
        values: game.values,
        notes: game.notes,
        elapsed: game.elapsed,
        mistakes: game.mistakes,
        hintsUsed: game.hintsUsed,
        completed: game.completed,
        correct: game.correct,
        difficulty: puzzle.difficulty,
      });
    }, SAVE_DELAY);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [
    puzzle.id,
    puzzle.difficulty,
    game.values,
    game.notes,
    game.elapsed,
    game.mistakes,
    game.hintsUsed,
    game.completed,
    game.correct,
  ]);

  // La rezolvare: salvam imediat si abia apoi anuntam parintele (statistici).
  // Asteptam scrierea ca lista de puzzle-uri sa vada progresul actualizat.
  useEffect(() => {
    if (!game.completed) {
      // Dupa un restart, puzzle-ul poate fi rezolvat din nou.
      wasCompleted.current = false;
      return undefined;
    }
    if (wasCompleted.current) return undefined;
    wasCompleted.current = true;

    let active = true;
    (async () => {
      await saveProgress(puzzle.id, {
        values: game.values,
        notes: game.notes,
        elapsed: game.elapsed,
        mistakes: game.mistakes,
        hintsUsed: game.hintsUsed,
        completed: true,
        correct: game.correct,
        difficulty: puzzle.difficulty,
      });
      if (active)
        onSolved?.(puzzle, game.elapsed, {
          mistakes: game.mistakes,
          hintsUsed: game.hintsUsed,
        });
    })();

    return () => {
      active = false;
    };
  }, [game.completed, game.values, game.notes, game.elapsed, game.mistakes, game.hintsUsed, game.correct, puzzle, onSolved]);

  /** Tastatura: cifre, backspace, sageti, N pentru creion. */
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key >= "1" && event.key <= "9") {
        game.inputDigit(Number(event.key));
      } else if (event.key === "Backspace" || event.key === "Delete") {
        game.eraseCell();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        game.moveSelection(-1, 0);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        game.moveSelection(1, 0);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        game.moveSelection(0, -1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        game.moveSelection(0, 1);
      } else if (event.key.toLowerCase() === "n") {
        game.setNoteMode((value) => !value);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [game]);

  const filledPercent = useMemo(
    () => Math.round((game.correct / 81) * 100),
    [game.correct]
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-2 pb-[env(safe-area-inset-bottom)] pt-4 sm:px-6">
      {/* ---------- bara de sus ---------- */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onExit} className="btn-sm">
          ← Înapoi la nivel
        </button>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {isDaily && (
            <span className="font-semibold text-warn">🗓️ Provocarea zilei</span>
          )}
          <span className="font-semibold text-white">
            #{puzzle.id}
            <span className={`ml-2 ${meta.color}`}>{meta.label}</span>
          </span>
          <span className="font-mono tabular-nums">⏱ {formatTime(game.elapsed)}</span>
          <span className={`tabular-nums ${game.mistakes > 0 ? "text-rose" : ""}`}>
            greseli: {game.mistakes}
            {game.mistakesLimit > 0 ? ` / ${game.mistakesLimit}` : ""}
          </span>
          <span className="tabular-nums">hint: {game.hintsUsed}</span>
        </div>
      </header>

      <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
        {/* ---------- tabla ---------- */}
        <section className="flex w-full max-w-[500px] flex-col items-center gap-3">
          <Board
            values={game.values}
            givens={game.givens}
            notes={game.notes}
            conflicts={game.conflicts}
            selected={game.selected}
            highlightDigit={game.highlightDigit}
            onSelect={game.selectCell}
          />

          <div className="w-full">
            <div className="mb-1 flex justify-between text-[0.65rem] text-muted">
              <span>completat corect</span>
              <span className="tabular-nums">{filledPercent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${filledPercent}%` }}
              />
            </div>
          </div>
        </section>

        {/* ---------- taste + actiuni ---------- */}
        <section className="flex w-full max-w-md flex-col items-center gap-3">
          <NumberPad
            values={game.values}
            highlightDigit={game.highlightDigit}
            noteMode={game.noteMode}
            onToggleNotes={() => game.setNoteMode((value) => !value)}
            onDigit={game.inputDigit}
            onErase={game.eraseCell}
            onUndo={game.undo}
            onHint={game.useHint}
            disabled={game.completed}
          />

          <button
            onClick={game.restart}
            className="btn-ghost w-full text-xs"
          >
            Reia puzzle-ul de la zero
          </button>

          <p className="text-center text-[0.65rem] leading-relaxed text-muted/70">
            Tastatura: 1-9 pentru cifre, Backspace pentru stergere, sageti pentru
            navigare, N pentru modul creion.
          </p>
        </section>
      </div>

      {/* ---------- mesaj de final ---------- */}
      {game.completed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-sm animate-fadeUp p-6 text-center">
            <p className="text-4xl">🎉</p>
            <h2 className="mt-3 text-xl font-bold">Puzzle rezolvat!</h2>
            <p className="mt-1 text-sm text-muted">
              #{puzzle.id} · {meta.label} · {formatTime(game.elapsed)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {game.mistakes} greşeli · {game.hintsUsed} hint-uri
            </p>

            <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5">
              <p className="font-mono text-lg font-bold text-accent">
                +{XP_PER_DIFFICULTY[puzzle.difficulty]} XP
              </p>
              <p className="text-[0.65rem] text-muted">
                {game.mistakes === 0 && game.hintsUsed === 0
                  ? "Perfect — fără greşeli, fără hint-uri! 💎"
                  : "XP-ul se acordă o singură dată per puzzle"}
              </p>
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={game.restart} className="btn-ghost flex-1 text-xs">
                Din nou
              </button>
              <button onClick={onExit} className="btn-primary flex-1 text-xs">
                Lista nivelului
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
