/**
 * Pagina principala: cele 1000 de puzzle-uri, sortate pe categorii de dificultate.
 * - In vizualizarea "Toate", puzzle-urile apar grupate in sectiuni (Usor / Mediu / Greu).
 * - Fiecare categorie poate fi deschisa separat, cu paginare.
 */

import { useMemo, useState } from "react";
import PuzzleCard from "./PuzzleCard.jsx";
import { DIFFICULTIES, formatTime } from "../lib/sudoku.js";

const PAGE_SIZE = 60;
const SECTION_PREVIEW = 12;

const CATEGORIES = [
  { key: "all", label: "Toate" },
  { key: "easy", label: "Ușor" },
  { key: "medium", label: "Mediu" },
  { key: "hard", label: "Greu" },
  { key: "done", label: "Rezolvate" },
  { key: "started", label: "Începute" },
];

const DIFFICULTY_ORDER = ["easy", "medium", "hard"];

export default function Home({
  puzzles,
  progress,
  stats,
  lastPlayed,
  onOpen,
  onContinue,
  onOpenTuring,
  onReset,
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const text = query.trim().replace("#", "");

  // Filtram + cautam dupa numarul puzzle-ului.
  const visible = useMemo(() => {
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
  }, [puzzles, progress, filter, text]);

  // In "Toate" (fara cautare), grupam pe categorii de dificultate.
  const groupedMode = filter === "all" && !text;
  const groups = useMemo(() => {
    if (!groupedMode) return [];
    return DIFFICULTY_ORDER.map((difficulty) => ({
      difficulty,
      items: visible.filter((puzzle) => puzzle.difficulty === difficulty),
    }));
  }, [groupedMode, visible]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = visible.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const solvedCount = useMemo(
    () => Object.values(progress).filter((entry) => entry.completed).length,
    [progress]
  );
  const startedCount = Math.max(0, Object.keys(progress).length - solvedCount);

  function changeFilter(key) {
    setFilter(key);
    setPage(0);
  }

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
              O mie de puzzle-uri cu soluție unică, grupate pe trei niveluri.
              Progresul se salvează automat în browser.
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
          <Stat label="Rezolvate" value={`${solvedCount} / 1000`} tone="text-good" />
          <Stat label="Începute" value={String(startedCount)} tone="text-accent" />
          <Stat
            label="Timp total"
            value={formatTime(stats.totalSeconds)}
            tone="text-slate-200"
          />
          <Stat
            label="Record ușor"
            value={stats.bestTimes?.easy ? formatTime(stats.bestTimes.easy) : "—"}
            tone="text-warn"
          />
        </div>
      </header>

      {/* ---------- joc bonus: Turing Test ---------- */}
      <button
        onClick={onOpenTuring}
        className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-panel/80 p-4 text-left transition hover:border-white/30 hover:bg-panel"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-good/40 bg-good/10 font-mono text-sm font-bold text-good">
            TT
          </span>
          <div>
            <p className="font-mono text-sm font-bold text-slate-100">
              Turing Test pentru Roboți
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Ghiceste codul de 4 culori in 10 incercari. Robotul raspunde vag.
            </p>
          </div>
        </div>
        <span className="btn-sm shrink-0 font-mono">Joacă →</span>
      </button>

      {/* ---------- controale: categorii + cautare ---------- */}
      <div className="flex flex-col gap-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((item) => (
            <button
              key={item.key}
              onClick={() => changeFilter(item.key)}
              className={`chip shrink-0 ${filter === item.key ? "chip-active" : "chip-idle"}`}
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
          placeholder="Caută după număr (ex: 42)"
          className="w-full rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm text-slate-100
            placeholder:text-muted/70 focus:border-accent/60 focus:outline-none sm:w-72"
        />
      </div>

      {/* ---------- lista, grupata pe categorii ---------- */}
      {groupedMode ? (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <CategorySection
              key={group.difficulty}
              difficulty={group.difficulty}
              items={group.items}
              progress={progress}
              onOpen={onOpen}
              onShowAll={() => changeFilter(group.difficulty)}
            />
          ))}
        </div>
      ) : (
        <>
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

          {pageCount > 1 && (
            <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
          )}
        </>
      )}

      <footer className="mt-auto pt-4 text-center text-[0.7rem] text-muted/70">
        {DIFFICULTIES.easy.label} · {DIFFICULTIES.medium.label} ·{" "}
        {DIFFICULTIES.hard.label} — toate puzzle-urile au o singură soluție.
      </footer>
    </div>
  );
}

/** Sectiunea unei categorii de dificultate, cu previzualizare + buton "Vezi toate". */
function CategorySection({ difficulty, items, progress, onOpen, onShowAll }) {
  const meta = DIFFICULTIES[difficulty];
  const first = items[0]?.id;
  const last = items[items.length - 1]?.id;

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-100">
          <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
          {meta.label}
          {first && (
            <span className="text-xs font-normal tabular-nums text-muted">
              #{first}–{last} · {items.length} puzzle-uri
            </span>
          )}
        </h2>

        {items.length > SECTION_PREVIEW && (
          <button
            onClick={onShowAll}
            className="shrink-0 text-xs font-semibold text-accent transition hover:text-accentSoft"
          >
            Vezi toate ({items.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.slice(0, SECTION_PREVIEW).map((puzzle) => (
          <PuzzleCard
            key={puzzle.id}
            puzzle={puzzle}
            progress={progress[puzzle.id]}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
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

function Stat({ label, value, tone }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[0.65rem] uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
