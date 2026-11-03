/**
 * Lista celor 1000 de puzzle-uri, cu filtre pe dificultate, cautare si paginare.
 * Paginarea tine DOM-ul mic (1000 de carduri ar fi prea mult deodata).
 */

import { useMemo, useState } from "react";
import PuzzleCard from "./PuzzleCard.jsx";
import { DIFFICULTIES, formatTime } from "../lib/sudoku.js";

const PAGE_SIZE = 60;

const FILTERS = [
  { key: "all", label: "Toate" },
  { key: "easy", label: "Usor" },
  { key: "medium", label: "Mediu" },
  { key: "hard", label: "Greu" },
  { key: "done", label: "Rezolvate" },
  { key: "started", label: "Incepute" },
];

export default function Home({ puzzles, progress, stats, lastPlayed, onOpen, onContinue, onReset }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  // Filtram + cautam dupa numarul puzzle-ului.
  const visible = useMemo(() => {
    const text = query.trim().replace("#", "");

    return puzzles.filter((puzzle) => {
      const entry = progress[puzzle.id];
      if (text && String(puzzle.id) !== text) return false;

      switch (filter) {
        case "easy":
        case "medium":
        case "hard":
          return puzzle.difficulty === filter;
        case "done":
          return Boolean(entry?.completed);
        case "started":
          return Boolean(entry && !entry.completed);
        default:
          return true;
      }
    });
  }, [puzzles, progress, filter, query]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = visible.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const solvedCount = useMemo(
    () => Object.values(progress).filter((entry) => entry.completed).length,
    [progress]
  );

  function changeFilter(key) {
    setFilter(key);
    setPage(0);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      {/* ---------- antet ---------- */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
              Sudoku <span className="text-accent">1000</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              O mie de puzzle-uri cu solutie unica. Progresul se salveaza automat in browser.
            </p>
          </div>

          <div className="flex gap-2">
            {lastPlayed && (
              <button onClick={onContinue} className="btn-primary">
                Continua #{lastPlayed}
              </button>
            )}
            <button onClick={onReset} className="btn-ghost">
              Reseteaza progresul
            </button>
          </div>
        </div>

        {/* ---------- statistici ---------- */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Rezolvate" value={`${solvedCount} / 1000`} tone="text-good" />
          <Stat
            label="Incepute"
            value={String(Math.max(0, Object.keys(progress).length - solvedCount))}
            tone="text-accent"
          />
          <Stat
            label="Timp total"
            value={formatTime(stats.totalSeconds)}
            tone="text-slate-200"
          />
          <Stat
            label="Record usor"
            value={stats.bestTimes?.easy ? formatTime(stats.bestTimes.easy) : "—"}
            tone="text-warn"
          />
        </div>
      </header>

      {/* ---------- filtre ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              onClick={() => changeFilter(item.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition
                ${
                  filter === item.key
                    ? "bg-accent text-ink"
                    : "border border-white/10 bg-white/5 text-slate-300 hover:border-accent/40 hover:text-white"
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          inputMode="numeric"
          placeholder="Cauta dupa numar (ex: 42)"
          className="w-full rounded-xl border border-white/10 bg-panel px-4 py-2 text-sm text-slate-100
            placeholder:text-muted/70 focus:border-accent/60 focus:outline-none sm:w-64"
        />
      </div>

      {/* ---------- lista ---------- */}
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

      {visible.length === 0 && (
        <p className="py-16 text-center text-sm text-muted">
          Niciun puzzle pentru filtrul curent.
        </p>
      )}

      {/* ---------- paginare ---------- */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 pb-6">
          <button
            onClick={() => setPage(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            className="btn-ghost px-3 py-1.5 text-xs"
          >
            ← Inapoi
          </button>
          <span className="px-2 text-xs tabular-nums text-muted">
            {safePage + 1} / {pageCount}
          </span>
          <button
            onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
            disabled={safePage >= pageCount - 1}
            className="btn-ghost px-3 py-1.5 text-xs"
          >
            Inainte →
          </button>
        </div>
      )}

      <footer className="mt-auto py-6 text-center text-[0.7rem] text-muted/70">
        {DIFFICULTIES.easy.label} · {DIFFICULTIES.medium.label} · {DIFFICULTIES.hard.label} —
        toate puzzle-urile au o singura solutie.
      </footer>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[0.65rem] uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-0.5 text-lg font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
